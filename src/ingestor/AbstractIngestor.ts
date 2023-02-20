import { Member, RelationType } from '@treecg/types'

export interface IRelation {
    type: RelationType
    value: string
    bucket: string
    path: string // should be SHACLPath
}

export interface IngestorConfig {
    /**
     * The Stream Identifier
     */
    streamIdentifier: string
}


export abstract class AbstractIngestor {
    protected streamIdentifier: string;

    public constructor(config: IngestorConfig) {
        this.streamIdentifier = config.streamIdentifier;
    }

    /**
     * Starts the database connection.
     */
    protected abstract startConnection(): Promise<void>

    /**
     * Sets up the database connection.
     * If the SDS Stream does not exist yet, persists metadata of the SDS stream in the database.
     * @param sdsMetadata - The SDS metadata for the SDS Stream.
     */
    public abstract initialise(sdsMetadata?: string): Promise<void>;

    /**
     * Closes the connection to the database.
     */
    public abstract exit(): Promise<void>;
    /**
     * Persists members in the database.
     * 
     * @param member 
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

