import { extractDate, LDES, Logger, storeToString, turtleStringToStore } from "@treecg/ldes-snapshot";
import { Member, RDF, RelationType, SDS } from '@treecg/types';
import { Document, WithId } from "mongodb";
import { DataFactory, Store } from 'n3';
import { MongoDBIngestor, MongoDBIngestorConfig } from "./MongoDBIngestor";
import { LDESTSOptions, TSIngestor, Window } from "./TSIngestor";
import { IViewDescription, MongoTSViewDescription, ViewDescription } from "ldes-solid-server";
const { namedNode, literal } = DataFactory;

export interface TSMongoDBIngestorConfig extends MongoDBIngestorConfig {
    viewDescriptionIdentifier: string
}
/**
 * Implements {@link TSIngestor} to store an LDES TSin a Mongo database.
 */
export class TSMongoDBIngestor extends MongoDBIngestor implements TSIngestor {
    protected _pageSize?: number;
    protected _timestampPath?: string;
    protected _metadata?: any;
    protected root = "";
    protected logger = new Logger(this);

    protected viewDescriptionIdentifier: string;

    public constructor(config: TSMongoDBIngestorConfig) {
        super(config);
        this.viewDescriptionIdentifier = config.viewDescriptionIdentifier;
    }

    protected get pageSize(): number {
        return this._pageSize ?? Infinity;
    }

    protected get timestampPath(): string {
        if (!this._timestampPath)
            throw Error("TimestampPath was not configured");
        return this._timestampPath;
    }

    async instantiate(config: LDESTSOptions): Promise<void> {
        await this.startConnection();
        if (await this.streamExists()) {
            const metadataStore = await this.getStreamMetadata(); // Note: currently a single stream can only have one viewDescription!! -> TODO: overwrite getMetadata
            const mongoTSVD = new MongoTSViewDescription(this.viewDescriptionIdentifier, this.streamIdentifier);
            const viewDescription = mongoTSVD.parseViewDescription(metadataStore);

            this._timestampPath = viewDescription.managedBy.bucketizeStrategy.path;
            if (viewDescription.managedBy.bucketizeStrategy.pageSize) {
                this._pageSize = viewDescription.managedBy.bucketizeStrategy.pageSize;
            } else {
                this._pageSize = Infinity;
            }
            this.logger.info(`View with description "${this.viewDescriptionIdentifier} for stream "${this.streamIdentifier}" exists already. timestampPath ${this.timestampPath} | pageSize ${this.pageSize}.`);
            return;
        }
        const { pageSize, timestampPath } = config;

        // Create metadata
        const viewDescription = this.createTSViewDescription(config);
        await this.dbMetaCollection.insertOne({
            id: this.streamIdentifier,
            descriptionId: this.viewDescriptionIdentifier,
            type: LDES.EventStream,
            value: storeToString(viewDescription.getStore())
        })

        // extract metadata from config
        this._pageSize = pageSize ?? Infinity;
        this._timestampPath = timestampPath;
        this._metadata = viewDescription;
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

        this.logger.info(`Initialialise TS View. Time Series oldest relation: ${date.toISOString()} | timestampPath ${this.timestampPath} | pageSize ${this.pageSize}.`);
    }


    async getMostRecentWindow(): Promise<Window> {
        const mostRecentBucket = await this.dbIndexCollection.find({ streamId: this.streamIdentifier }).sort({ "start": -1 }).limit(1).next();
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
        const bucket = await this.getBucket(window.identifier);
        if (!bucket.members) return 0; // though members should always exist
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
        await this.dbIndexCollection.updateOne({ streamId: this.streamIdentifier, id: identifier }, { "$set": windowParams });
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
        await this.dbIndexCollection.updateOne({ streamId: this.streamIdentifier, id: identifier }, { "$set": windowParams });
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
            this.logger.debug('bucketSize: ' + bucketSize)
            this.logger.debug('pageSize: ' + this.pageSize)

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

            // add member
            await this.storeMember(member);
            await this.addMemberstoBucket(newWindow.identifier, [member.id.value]);
        } else {
            // add member
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
     * Creates a TS Viewdescription that contains the metadata so the LDES Solid Server can serve the LDES.
     * @param config
     * @returns {ViewDescription}
     */
    private createTSViewDescription(config: LDESTSOptions): IViewDescription {
        const mongoTSVD = new MongoTSViewDescription(this.viewDescriptionIdentifier, this.streamIdentifier);
        return mongoTSVD.generateViewDescription(config);
    }
}
