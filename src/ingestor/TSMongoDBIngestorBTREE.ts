import {Window} from "./TSIngestor";
import {TSMongoDBIngestor} from "./TSMongoDBIngestor";
import {RelationType} from "@treecg/types";

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

    //TODO: get mostRecentWindow needs to check if there are relations, if there are any, than we have not found our guy
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
        // currently a list of Windows from root node -> ... -> window
        const chain = await this.getWindowChain(currentWindow);
        const nodeIdentifier = (await this.findNodeForNewWindow(chain)).identifier

        if (this.root === nodeIdentifier && (await this.getBucket(this.root)).relations.length + 1 > this.layerSize){
            console.log('a new window must be created for the root')
            // TODO: follow code for root in pseudocode
        }
        return newWindow.identifier;
    }

    /**
     * Calculates the chain from the root to the window
     * @param window
     * @return {Promise<void>}
     */
    public async getWindowChain(window: Window): Promise<Window[]> { // TODO: make protected
        // Note: currently a shortcut to get the latest window chain
        const chain: Window[] = [window]
        if (window.identifier === this.root){
            return chain
        }
        const parentFragment = await this.dbIndexCollection.findOne({
            streamId: this.streamIdentifier,
            relations:
                {
                    $in: [{
                        type: RelationType.GreaterThanOrEqualTo,
                        value: new Date(window.start!).toISOString(),
                        path: this.timestampPath!,
                        bucket: window.identifier
                    }]
                }
        })
        if (!parentFragment){
            throw Error("No parent found of" + window.identifier)
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

            if (fragment.relations.length < this.layerSize){
                return window
            }
        }
        console.log("No windows found: So root is returned.")
        return chain[0]; // this will always be the root
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
