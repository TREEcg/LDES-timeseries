import { Quad } from "@rdfjs/types";
import { SimpleStream, Stream } from "@treecg/connector-types";
import { extractMembers, turtleStringToStore } from "@treecg/ldes-snapshot";
import { ingest } from "@treecg/sds-storage-writer-mongo";
import { Store } from "n3";
import { storeFromFile } from '../dist/Index';
const { MongoClient } = require("mongodb")

/**
 * This script uses the {@link ingest} method of the @treecg/sds-storage-writer-mongo to add some data to an LDES which can then be hosted using the ldes solid store
 * 
 * run in script directory by invoking `npx ts-node attempt-ingesting.ts`
 */
async function main() {
    // constants
    const fileName = "../data/location-LDES.ttl"
    const ldesIdentifier = "http://localhost:3000/lil/#EventStream"

    // mongoDB constants
    const metaCollectionDB = "meta" // contains the sds metadata in the mongoDB
    const dataCollectionDB = "data" // contains the members in the mongoDB
    const indexCollectionDB = "index" // contains the fragments in the mongoDB
    const mongoDBURL = "mongodb://localhost:27017/ldes2"
    const ldesID = "http://me#csvStream"
    const store = await storeFromFile(fileName);

    const members = extractMembers(store, ldesIdentifier);

    // console.log(await quadsToString(members[0].quads));+

    // trying to ingest data
    const dataStream = new SimpleStream<Quad[]>();
    const metadataStream = new SimpleStream<Quad[]>();


    type SR<T> = {
        [P in keyof T]: Stream<T[P]>;
    }

    type Data = {
        data: Quad[],
        metadata: Quad[],
    }
    
    const streamReader: SR<Data> = {data: dataStream, metadata: metadataStream};
    // ingests member from `data.ttl` to the mongo db for an existing LDES
    // 1. fetches SDS metadata of a given LDES (when exists)
    // 1a. pushes metadata to the mongoDBwriter

    // 2. post an actual member to the `data` collection in the mongoDB
    await ingest(streamReader, metaCollectionDB, dataCollectionDB, indexCollectionDB, "https://w3id.org/ldes#TimestampFragmentation", mongoDBURL);

    const sdsMetadata = (await fetchSDSMetadata(mongoDBURL, metaCollectionDB, ldesID)).getQuads(null, null, null, null);
    const exampleMemberStore = await storeFromFile('../data/data.ttl')

    metadataStream.push(sdsMetadata)
    dataStream.push(exampleMemberStore.getQuads(null, null, null, null));
}
main()


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

