import { Member } from '@treecg/types';

/**
 * Interface for an LDES Time-Series Window.
 */
export interface Window {
    /**
     * The identifier of the window in the database.
     */
    identifier: string;
    /**
     * The minimum bounding timestamp of the window.
     */
    start?: Date;
    /**
     * The maximum bounding timstamp of the window.
     */
    end?: Date;
    /**
     * The identifiers of the members in the given window.
     */
    memberIdentifiers?: string[];
}
/**
 * Interface to instantiate an {@link TSIngestor}.
 */
export interface LDESTSConfig {
    /**
     * Identifier of the SDS stream.
     */
    sdsStreamIdentifier: string;
    /**
     * SHACL property path used to indicate on which member property the relation applies.
     */
    timestampPath: string;
    /**
     * Number of members per window (same as fragmentationSize and bucketSize).
     */
    pageSize?: number;
    /**
     * Date of the value of the first relation that will be created.
     */
    date?: Date;
}

/**
 * Interface to ingest members into an LDES Time Series.
 * Furthermore implementing the interface allows for easily creating new windows for the TS.
 */
export interface TSIngestor {
    instantiate(config: LDESTSConfig): Promise<void>;
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
