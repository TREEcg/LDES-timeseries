import { extractMembers } from "@treecg/ldes-snapshot";
import { storeFromFile, TSMongoDBIngestor } from "./";
import {TSMongoDBIngestorBTREE} from "./";

async function main() {
    // load some members
    const fileName = "./data/location-LDES.ttl"
    const ldesIdentifier = "http://localhost:3000/lil/#EventStream"
    const store = await storeFromFile(fileName);
    const members = extractMembers(store, ldesIdentifier);


    const streamIdentifier = "http://example.org/myStream#eventStream"
    const viewDescriptionIdentifier = "http://example.org/myStream#viewDescription"

    const pageSize = 2;
    const layerSize = 10;
    const ldesTSConfig = {
        timestampPath: "http://www.w3.org/ns/sosa/resultTime",
        pageSize: pageSize,
        date: new Date("2022-08-07T08:08:21Z")
    }
    const ingestor = new TSMongoDBIngestorBTREE({ streamIdentifier: streamIdentifier, viewDescriptionIdentifier: viewDescriptionIdentifier });


    await ingestor.instantiate(ldesTSConfig);

    await ingestor.publish(members.slice(0,400));
    await ingestor.exit();
}
main()
