import { extractMembers } from "@treecg/ldes-snapshot";
import { storeFromFile, TSMongoDBIngestor } from "./";

async function main() {
    // load some members
    const fileName = "./data/location-LDES.ttl"
    const ldesIdentifier = "http://localhost:3000/lil/#EventStream"
    const store = await storeFromFile(fileName);
    const members = extractMembers(store, ldesIdentifier);


    const sdsIdentifier = "http://example.org/sds"
    const ldesTSConfig = {
        sdsStreamIdentifier: sdsIdentifier,
        timestampPath: "http://www.w3.org/ns/sosa/resultTime",
        pageSize: 50,
        date: new Date("2022-08-07T08:08:21Z")
    }
    const ingestor = new TSMongoDBIngestor({ sdsStreamIdentifier: sdsIdentifier });


    await ingestor.instantiate(ldesTSConfig);
    // await ingestor.publish(members)

    await ingestor.exit();
}
main()
