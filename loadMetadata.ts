import { Store } from "n3";
const { MongoClient } = require("mongodb")
import { turtleStringToStore} from "@treecg/ldes-snapshot";

export async function fetchSDSMetadata(mongoDBURL: string, collection: string, ldesID:string): Promise<Store>{
    const mongo = await new MongoClient(mongoDBURL).connect();
    let store: Store;

    const db = mongo.db();

    const metaCollection = db.collection(collection);

    const sdsMetaObject = await metaCollection.findOne({id:ldesID});
    if (!sdsMetaObject) {
        throw Error("No SDS metadata found for LDES identifier: " + ldesID)
    }
    await mongo.close();
    const metadataStore = await turtleStringToStore(sdsMetaObject.value);
    return metadataStore
}

