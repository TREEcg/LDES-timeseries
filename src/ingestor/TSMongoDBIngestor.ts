import { extractDate, LDES, Logger, storeToString, turtleStringToStore } from "@treecg/ldes-snapshot";
import { Member, RDF, RelationType, SDS } from '@treecg/types';
import { Document, WithId } from "mongodb";
import { DataFactory, Store } from 'n3';
import { MongoDBIngestor } from "./MongoDBIngestor";
import { LDESTSConfig, TSIngestor, Window } from "./TSIngestor";
const { namedNode, literal } = DataFactory;

/**
 * Implements {@link TSIngestor} to store an LDES TSin a Mongo database.
 */
export class TSMongoDBIngestor extends MongoDBIngestor implements TSIngestor {
    protected _pageSize?: number;
    protected _timestampPath?: string;
    protected _metadata?: any;
    protected root = "";
    protected logger = new Logger(this);


    private get pageSize(): number {
        return this._pageSize ?? Infinity;
    }

    private get timestampPath(): string {
        if (!this._timestampPath)
            throw Error("TimestampPath was not configured");
        return this._timestampPath;
    }

    async instantiate(config: LDESTSConfig): Promise<void> {
        await this.startConnection();
        if (await this.streamExists()) {
            const metadata = await this.getSDSMetadata();
            const metadataStore = await turtleStringToStore(metadata);

            const ldesNode = metadataStore.getQuads(this.sdsStreamIdentifier, SDS.terms.dataset, null, null)[0].object;
            this._timestampPath = metadataStore.getQuads(ldesNode, LDES.timestampPath, null, null)[0].object.value;
            const pageSizeExists = metadataStore.getQuads(ldesNode, LDES.pageSize, null, null)[0];
            if (pageSizeExists) {
                this._pageSize = Number(pageSizeExists.object.value);
            } else {
                this._pageSize = Infinity;
            }
            this.logger.info(`SDS exists already. timestampPath ${this.timestampPath} | pageSize ${this.pageSize}.`);
            return;
        }
        const { pageSize, timestampPath } = config;
        const sdsMetadata = this.makeSDSConfig(config);
        await this.initialise(sdsMetadata);

        // extract metadata from config
        this._pageSize = pageSize ?? Infinity;
        this._timestampPath = timestampPath;
        this._metadata = sdsMetadata;
        const date = config.date ?? new Date();

        // create root
        await this.createBucket(this.root);

        // create first window
        const firstWindow: Window = {
            identifier: date.valueOf() + '',
            start: date
        };
        await this.createWindow(firstWindow);
        await this.addWindowToRoot(firstWindow);

        this.logger.info(`Initialialise SDS. Time Series oldest relation: ${date.toISOString()} | timestampPath ${this.timestampPath} | pageSize ${this.pageSize}.`);
    }


    async getMostRecentWindow(): Promise<Window> {
        const mostRecentBucket = await this.dbIndexCollection.find({ streamId: this.sdsStreamIdentifier }).sort({ "start": -1 }).limit(1).next();
        if (!mostRecentBucket) {
            throw Error("No buckets present");
        }

        return this.documentToWindow(mostRecentBucket);
    }

    /**
     * Transforms a MongoDB document to a {@link Window}.
     * @param document
     * @returns
     */
    protected documentToWindow(document: WithId<Document>): Window {
        return {
            identifier: document.id,
            memberIdentifiers: document.members,
            start: new Date(document.start),
            end: new Date(document.start)
        };
    }

    async bucketSize(window: Window): Promise<number> {
        const bucket = await this.dbIndexCollection.findOne({ id: window.identifier, streamId: this.sdsStreamIdentifier });
        if (!bucket) {
            throw Error("Window with identifier " + window.identifier + " was not found in the database");
        }
        return bucket.members.length;
    }

    async createWindow(window: Window): Promise<void> {
        const { identifier, start, end } = window;

        await this.createBucket(identifier);

        const windowParams: any = {};
        if (start) {
            windowParams.start = start.toISOString();
        }
        if (end) {
            windowParams.end = end.toISOString();
        }
        await this.dbIndexCollection.updateOne({ streamId: this.sdsStreamIdentifier, id: identifier }, { "$set": windowParams });
    }

    async updateWindow(window: Window): Promise<void> {
        const { identifier, start, end } = window;

        const windowParams: any = {};
        if (start) {
            windowParams.start = start.toISOString();
        }
        if (end) {
            windowParams.end = end.toISOString();
        }
        await this.dbIndexCollection.updateOne({ streamId: this.sdsStreamIdentifier, id: identifier }, { "$set": windowParams });
    }

    async addWindowToRoot(window: Window): Promise<void> {
        const { identifier, start } = window;

        if (!start)
            throw Error("Can not add window " + identifier + " to the root as it has no start date value");
        await this.addRelationsToBucket(this.root, [{
            type: RelationType.GreaterThanOrEqualTo,
            value: start.toISOString(),
            path: this.timestampPath,
            bucket: identifier
        }]);
    }

    async append(member: Member): Promise<void> {
        const currentWindow = await this.getMostRecentWindow();
        const bucketSize = await this.bucketSize(currentWindow);

        if (bucketSize + 1 > this.pageSize) {
            const memberDate = extractDate(new Store(member.quads), this.timestampPath);
            const newWindow: Window = {
                identifier: memberDate.valueOf() + '',
                start: memberDate
            };
            // create new window
            await this.createWindow(newWindow);
            await this.addWindowToRoot(newWindow);

            // add end date to old window
            currentWindow.end = memberDate;
            await this.updateWindow(currentWindow);
            await this.addRelationsToBucket(this.root, [{
                type: RelationType.LessThan,
                value: memberDate.toISOString(),
                path: this.timestampPath,
                bucket: currentWindow.identifier
            }]);
        } else {
            await this.storeMember(member);
            await this.addMemberstoBucket(currentWindow.identifier, [member.id.value]);
        }
    }

    async publish(members: Member[]): Promise<void> {
        // inefficient implementation
        for (const member of members) {
            await this.append(member);
        }
    }

    /**
     * Creates an SDS configuration that contains the information so the LDES Solid Server can host the LDES.
     * Furthermore, {@link TSMongoDBIngestor} is initialised correctly using this configuration.
     * @param config 
     * @returns 
     */
    private makeSDSConfig(config: LDESTSConfig): string {
        const { sdsStreamIdentifier, timestampPath, pageSize } = config;
        const dataSetNode = namedNode("http://example.org/sds#dataset");
        const sdsMetadataStore = new Store();
        sdsMetadataStore.addQuad(namedNode(sdsStreamIdentifier), RDF.terms.type, SDS.terms.Stream);
        sdsMetadataStore.addQuad(namedNode(sdsStreamIdentifier), SDS.terms.carries, SDS.terms.Member);
        sdsMetadataStore.addQuad(namedNode(sdsStreamIdentifier), SDS.terms.dataset, dataSetNode);

        sdsMetadataStore.addQuad(dataSetNode, RDF.terms.type, LDES.terms.EventStream);
        sdsMetadataStore.addQuad(dataSetNode, LDES.terms.timestampPath, namedNode(timestampPath));
        if (pageSize) {
            sdsMetadataStore.addQuad(dataSetNode, LDES.terms.pageSize, literal(pageSize));
        }
        return storeToString(sdsMetadataStore);
    }
}
