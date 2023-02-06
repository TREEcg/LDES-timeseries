import { Quad } from "@rdfjs/types";
import { SimpleStream, Stream } from "@treecg/connector-types";
import { extractMembers, storeToString, turtleStringToStore } from "@treecg/ldes-snapshot";
import { ingest } from "@treecg/sds-storage-writer-mongo";
import { existsSync, readFileSync } from "fs";
import { Store } from "n3";
import { fetchSDSMetadata } from "./loadMetadata";

export async function storeFromFile(filepath: string): Promise<Store> {
    if (!existsSync(filepath)){
        throw Error("The filepath is invalid.");
    }
    // if the file content is invalid, the method below will throw a
    // different error
    return await turtleStringToStore(readFileSync(filepath, "utf-8"));
}

export async function quadsToString(quads: Quad[]):Promise<string> {
    return storeToString(new Store(quads))
}

// constants
const fileName = "location-LDES.ttl"
const ldesIdentifier = "http://localhost:3000/lil/#EventStream"

// mongoDB constants
const metaCollectionDB = "meta" // contains the sds metadata in the mongoDB
const dataCollectionDB = "data" // contains the members in the mongoDB
const indexCollectionDB = "index" // contains the fragments in the mongoDB
const mongoDBURL = "mongodb://localhost:27017/ldes2"
const ldesID = "http://me#csvStream"

async function main() {
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
    const exampleMemberStore = await storeFromFile('data.ttl')

    metadataStream.push(sdsMetadata)
    dataStream.push(exampleMemberStore.getQuads(null, null, null, null));
}
main()
