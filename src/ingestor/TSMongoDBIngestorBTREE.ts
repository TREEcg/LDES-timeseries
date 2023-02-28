import {Window} from "./TSIngestor";
import {TSMongoDBIngestor} from "./TSMongoDBIngestor";
import {Member, RelationType} from "@treecg/types";
import {v4 as uuidv4} from 'uuid';
import {IRelation} from "./AbstractIngestor";
import {extractDate} from "@treecg/ldes-snapshot";
import {Store} from "n3";

/**
 * Class which makes it possible to create multiple layers for the time-series.
 * (in contrast to the {@link TSMongoDBIngestor}, which only allows for having one layer)
 *
 *
 */
export class TSMongoDBIngestorBTREE extends TSMongoDBIngestor {
    /**
     * Variable for the number of relations per node in the view of the LDES.
     * Note: currently hardcoded
     */
    protected layerSize = 10;

    public async append(member: Member) {
        const currentWindow = await this.getMostRecentWindow();
        const bucketSize = await this.bucketSize(currentWindow);

        let windowIdentifierForMember = currentWindow.identifier
        if (bucketSize + 1 > this.pageSize) {

            const memberDate = extractDate(new Store(member.quads), this.timestampPath);
            windowIdentifierForMember = await this.addWindow(memberDate);
        }
        const window = await this.getWindow(windowIdentifierForMember)
        const chain = await this.getWindowChain(window)
        this.logger.info(`adding member ${member.id.value} to window ${windowIdentifierForMember}, placed in depth: ${chain.length}`)
        // add member
        await this.storeMember(member);
        await this.addMemberstoBucket(windowIdentifierForMember, [member.id.value]);
    }

    async getMostRecentWindow(): Promise<Window> {
        //TODO: get mostRecentWindow needs to check if there are relations, if there are any, than we have not found our guy
        const mostRecentBucket = await this.dbIndexCollection.find({streamId: this.streamIdentifier, relations:[]}).sort({"start": -1}).limit(1).next();
        // const test = await this.dbIndexCollection.find({streamId: this.streamIdentifier, relations:[]}).sort({"start": -1})
        // console.log(await test.toArray())
        if (!mostRecentBucket) {
            throw Error("No buckets present");
        }
        return this.documentToWindow(mostRecentBucket);
    }
    /**
     * Creates a new window and adds it to the appropriate node.
     * Furthermore, adds the correct relations to this new node.
     *
     * @param date - The date to which all members in this new window will be GTE than.
     * @return {string} - The identifier of the newly created window.
     */
    public async addWindow(date: Date): Promise<string> { // TODO: make protected
        const newWindow: Window = {
            identifier: date.valueOf() + '',
            start: date
        };
        const currentWindow = await this.getMostRecentWindow();
        // this.logger.info('current most recent Window:' + currentWindow.identifier)
        // currently a list of Windows from root node -> ... -> window (top down chain of nodes)
        const chain = await this.getWindowChain(currentWindow);
        const nodeForNewWindow = await this.findNodeForNewWindow(chain)
        const nodeIdentifier = nodeForNewWindow.identifier

        // TODO: root.relations.length gives the relations double -> filter on unique bucket | create function uniqueNodes
        if (this.root === nodeIdentifier && (await this.getBucket(this.root)).relations.length + 1 > this.layerSize) {
            const rootFragment = await this.getBucket(this.root);
            this.logger.info(`A new layer is added as the root points to too many nodes. (layer size: ${this.layerSize} | amount of relations from root: ${rootFragment.relations.length})`)
            const newNodeIdentifier = uuidv4();
            const newWindowLayer = {identifier: newNodeIdentifier, start: new Date(0), end: date} // TODO: retrieve start -> oldest date in root Relations.

            // remove all relations from root: sameAs deleting and creating again (As nothing important is actually stored there (atleast there shouldn't be)
            await this.deleteBucket(this.root)
            await this.createBucket(this.root)
            await this.createWindow(newWindowLayer)
            const rootRelations = rootFragment.relations.map(({type, value, path, bucket}) => {
                return {type, value, path: path!, bucket} as IRelation
            })
            await this.addRelationsToBucket(newNodeIdentifier, rootRelations)
            await this.addWindowToRoot(newWindowLayer)

            const window = await this.createChain(date, this.root, chain.length);
            return window.identifier
        }
        const position = chain.indexOf(nodeForNewWindow)
        if (position === -1) throw Error("Could not find node in chain " + nodeIdentifier);
        const window = await this.createChain(date, nodeIdentifier, chain.length - (position+1));
        return window.identifier
    }

    /**
     * Calculates the chain from the root to the window.
     *
     * Works bottom up.
     * Assumption: there are no two nodes with the same identifier within a stream.
     * @param window
     * @return {Promise<void>}
     */
    public async getWindowChain(window: Window): Promise<Window[]> { // TODO: make protected
        // Note: currently a shortcut to get the latest window chain
        const chain: Window[] = [window]
        if (window.identifier === this.root) {
            return chain
        }
        const parentFragment = await this.dbIndexCollection.findOne({
            streamId: this.streamIdentifier,
            "relations.type": RelationType.GreaterThanOrEqualTo,
            "relations.value": new Date(window.start!).toISOString(),
            "relations.path": this.timestampPath!,
            "relations.bucket": window.identifier,
        })
        if (!parentFragment) {
            console.log({
                type: RelationType.GreaterThanOrEqualTo,
                value: new Date(window.start!).toISOString(),
                path: this.timestampPath!,
                bucket: window.identifier
            })
            throw Error(`No parent found for ${window.identifier}`)
        }
        const parentWindow = this.documentToWindow(parentFragment)
        chain.unshift(...await this.getWindowChain(parentWindow))
        return chain;
    }

    /**
     * Find a node that has less relations than the maximum allowed number of relations.
     *
     * If no such is found, return the root.
     * @param chain
     * @return {Promise<void>}
     */
    public async findNodeForNewWindow(chain: Window[]): Promise<Window> { //TODO: make protected
        const reverseChain = [...chain].reverse()
        // remove top window as this is one that is reserved to only have members
        reverseChain.shift()
        for (const window of reverseChain) {
            const fragment = await this.getBucket(window.identifier)

            if (fragment.relations.length < this.layerSize) {
                return window
            }
        }
        this.logger.info("No windows found: So root is returned.")
        return chain[0]; // this will always be the root
    }

    /**
     * Creates a chain of nodes from identifier with given length, ending with the node `date.toISOString()`.
     *
     * Assumptions, the start node already exists.
     * @param date - The date to which all members in the bottom node will be GTE.
     * @param identifier - identifier of the node where the chain starts
     * @param chainLength - The length of the chain (i.e. how many nodes are created).
     * @return {Promise<void>}
     */
    public async createChain(date: Date, identifier: string, chainLength: number): Promise<Window> {
        if (chainLength <= 0) {
            return await this.getWindow(identifier)
        }
        const newNodeIdentifier = uuidv4();
        const newWindowLayer = {identifier: newNodeIdentifier, start: date};
        await this.createWindow(newWindowLayer)
        await this.addRelationsToBucket(identifier, [{
            type: RelationType.GreaterThanOrEqualTo,
            bucket: newNodeIdentifier,
            value: date.toISOString(),
            path: this.timestampPath
        }])
        return await this.createChain(date, newNodeIdentifier, chainLength - 1)
    }
}

// class Chain<T> implements Iterable<T> {
//     constructor( private values: T[]) {
//     }
//
//     [Symbol.iterator](): ChainIterator<T> {
//         return new ChainIterator<T>(this.values);
//     }
// }
//
// class ChainIterator<T>
