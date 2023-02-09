import { extractMembers, Logger, RDF, turtleStringToStore } from "@treecg/ldes-snapshot";
import { Member, SDS } from '@treecg/types';
import { readFileSync } from "fs";
import { TSIngestor } from "./AbstractIngestor";
import { TSMongoDBIngestor } from "./MongoDBIngestor";
import { storeFromFile } from "./util";
/**
 * Base Publisher class for timeseries data publishing, with buckets using a date representation
 * Different implementations use different strategies, having their own benefits and drawbacks
 */
export abstract class Publisher {
    protected readonly logger: Logger;
    protected ingestor: TSIngestor;

    protected timestampPath = "http://www.w3.org/ns/sosa/resultTime" // TODO: make configurable
    protected _pageSize: number;

    public constructor(ingestor: TSIngestor, logger?: Logger) {
        this.logger = logger ?? new Logger(this);
        this.ingestor = ingestor;

        // TODO: configure properly
        this._pageSize = 50;
    }

    public get pageSize(): number{
        return this._pageSize;
    
    }

    public async init() {
        // load example sds configuration | TODO: replace with real config
        const sdsMetadataString = readFileSync('../sds-metadata.ttl', 'utf-8');
        await this.ingestor.instantiate(sdsMetadataString);

    }

    /**
     * Publishes all members and fragment them.
     * 
     * Assumption: Expects members to be sorted chronologically and to be newer than everything that is already in the database
     * @param members 
     */
    public async publish(members: Member[]): Promise<void> {
        // inefficent implementation
        members.forEach(async (member) => {
            await this.append(member);
        })
    }

    public async append(member: Member): Promise<void> {
        const currentWindow = await this.ingestor.getMostRecentWindow();
        const bucketSize = await this.ingestor.bucketSize(currentWindow);
        
        // if (bucketSize + 1 < this._pageSize) {
        //     // TODO:create new window
        //     this.logger.info("Following member was not added because new window was not implemented yet: "+member.id.value);
            
        // } else {
        //     await this.ingestor.storeMember(member);
        //     await this.ingestor.addMemberstoBucket(currentWindow, [member.id.value]);
        // }
    }

    protected async getMetadata() {

    }

}
async function main() {

    // load example sds configuration | TODO: replace with real config
    const sdsMetadataString = readFileSync('../sds-metadata.ttl', 'utf-8');
    const sdsMetadataStore = await turtleStringToStore(sdsMetadataString);
    const sdsIdentifier = sdsMetadataStore.getSubjects(RDF.type, SDS.Stream, null)[0].value;
    
    // load some members
    const fileName = "../location-LDES.ttl"
    const ldesIdentifier = "http://localhost:3000/lil/#EventStream"
    const store = await storeFromFile(fileName);
    const members = extractMembers(store, ldesIdentifier);

    const ingestor = new TSMongoDBIngestor({ sdsStreamIdentifier: sdsIdentifier });


    await ingestor.instantiate(sdsMetadataString);
    await ingestor.publish(members)
    
    await ingestor.exit();
}
main()