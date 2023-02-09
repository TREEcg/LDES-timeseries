import { SDS, Member, RelationType } from '@treecg/types'

export interface IRelation {
    type: RelationType
    value: string
    bucket: string
    path: string // should be SHACLPath
}

export interface IngestorConfig {
    /**
     * The identifier of the SDS Stream
     */
    sdsStreamIdentifier: string
}


export abstract class AbstractIngestor {
    protected sdsStreamIdentifier: string;

    public constructor(config: IngestorConfig) {
        this.sdsStreamIdentifier = config.sdsStreamIdentifier;
    }

    /**
     * Sets up the DB connection.
     * If the SDS Stream does not exist yet, persists metadata of the SDS stream in the database.
     * @param sdsMetadata - The SDS metadata for the SDS Stream.
     */
    public abstract initialise(sdsMetadata?: string): Promise<void>;

    public abstract exit(): Promise<void>;
    /**
     * Persists members in the database.
     * 
     * @param member 
     * @param timestamp 
     */
    public abstract storeMembers(member: Member[]): Promise<void>;

    /**
     * Creates a bucket in the database.
     * 
     * @param bucketIdentifier 
     * @param relations 
     */
    public abstract createBucket(bucketIdentifier: string): Promise<void>;

    // protected abstract getBucket(bucketIdentifier: string): Promise<void>;


    /**
     * Adds members to a bucket. 
     * If the bucket does not exist yet, a bucket MUST be created with the name of that bucket.
     * 
     * Note: If the bucket was created during this operation, it MUST still be added to some other bucket reachable from the root node.
     * 
     * @param bucketIdentifier - The bucket where the members are added to.
     * @param memberIDs - An array of member identifiers. 
     */
    public abstract addMemberstoBucket(bucketIdentifier: string, memberIDs: string[]): Promise<void>;

    /**
     * Adds relations to a bucket. 
     * If the bucket property of a relations do not exist yet, a bucket MUST be created with the name of that bucket.
     * 
     * If the bucket does not exist yet, a bucket MUST be created with the name of that bucket.
     * Note: If the bucket was created during this operation, it MUST still be added to some other bucket reachable from the root node.
     * @param bucketIdentifier - The bucket where the relations are added to.
     * @param relations - An array of relation descriptions to another bucket.
     */
    public abstract addRelationsToBucket(bucketIdentifier: string, relations: IRelation[]): Promise<void>;

    public async storeMember(member: Member): Promise<void> {
        await this.storeMembers([member]);
    }
}

export interface Window {
    /**
     * The identifier of the window in the database.
     */
    identifier: string,
    /**
     * The minimum bounding timestamp of the window.
     */
    start?: Date,
    /**
     * The maximum bounding timstamp of the window.
     */
    end?: Date,
    /**
     * The identifiers of the members in the given window.
     */
    memberIdentifiers?: string[]
}

export interface TSIngestor {
    instantiate(config: string): Promise<void>;
    /**
     * Creates a window.
     * @param window 
     */
    createWindow(window: Window): Promise<void>;

    /**
     * Updates the start and/or endDate of a window
     * @param window 
     */
    updateWindow(window: Window): Promise<void>;

    /**
     * Adds a GTE relation from the root to the given window based on its start date.
     * @param window 
     */
    addWindowToRoot(window: Window): Promise<void>;

    /**
     * Searches for the most recent window.
     */
    getMostRecentWindow(): Promise<Window>;

    /**
     * Retrieves the number of members from a given window.
     * @param window 
     */
    bucketSize(window: Window): Promise<number>;

    /**
     * Adds one member to LDES.
     * The assumption is that its timestamp is the biggest in the database.
     * When this is not the case, the fragmentation might be wrong
     * @param member 
     */
    append(member: Member): Promise<void>;

    /**
     * Adds multiple members to the LDES.
     * The assumption is that all members given are in chronological order 
     * and bigger thant the biggest timestamp in the database.
     * @param members 
     */
    publish(members: Member[]): Promise<void>;
}