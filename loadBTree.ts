import { extractMembers } from "@treecg/ldes-snapshot";
import { storeFromFile, TSMongoDBIngestor } from "./";
import {TSMongoDBIngestorBTREE} from "./";
import {logMaximumMembersForDepth} from "./src/util/BTreeUtil";

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
    ingestor.layerSize = layerSize
    logMaximumMembersForDepth(pageSize, layerSize)

    await ingestor.instantiate(ldesTSConfig);

    await ingestor.publish(members);
    await ingestor.exit();
}
main()


// pageSize 2 - layerSize 10 (446 members total)
// 2023-03-01T09:19:36.610Z [TSMongoDBIngestorBTREE] info: Initialialise TS View. Time Series oldest relation: 2022-08-07T08:08:21.000Z | timestampPath http://www.w3.org/ns/sosa/resultTime | pageSize 2.
// 2023-03-01T09:19:36.714Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 3 (layer size: 10 | amount of nodes from root: 10)
// 2023-03-01T09:19:37.308Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 4 (layer size: 10 | amount of nodes from root: 10)
// 2023-03-01T09:19:38.141Z [TSMongoDBIngestorBTREE] closing connection to the Mongo Database.

// ingesting about 200 members per second on my laptop
// pageSize 10 - layerSize 10 (9624 members total)
// 2023-03-01T09:19:59.403Z [TSMongoDBIngestorBTREE] info: Initialialise TS View. Time Series oldest relation: 2020-12-05T02:17:25.000Z | timestampPath http://www.w3.org/ns/sosa/resultTime | pageSize 10.
// 2023-03-01T09:19:59.697Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 3 (layer size: 10 | amount of nodes from root: 10)
// 2023-03-01T09:20:01.958Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 4 (layer size: 10 | amount of nodes from root: 10)
// 2023-03-01T09:20:44.131Z [TSMongoDBIngestorBTREE] closing connection to the Mongo Database.

// pageSize 2 - layerSize 5 (446 members total)
// 2023-03-01T09:30:54.681Z [TSMongoDBIngestorBTREE] info: Initialialise TS View. Time Series oldest relation: 2022-08-07T08:08:21.000Z | timestampPath http://www.w3.org/ns/sosa/resultTime | pageSize 2.
// 2023-03-01T09:30:54.744Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 3 (layer size: 5 | amount of nodes from root: 5)
// 2023-03-01T09:30:54.898Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 4 (layer size: 5 | amount of nodes from root: 5)
// 2023-03-01T09:30:55.730Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 5 (layer size: 5 | amount of nodes from root: 5)
// 2023-03-01T09:30:56.522Z [TSMongoDBIngestorBTREE] closing connection to the Mongo Database.

// ingesting about 160 members per second on my laptop
// pageSize 10 - layerSize 5 (9624 members total)
// 2023-03-01T09:31:17.434Z [TSMongoDBIngestorBTREE] info: Initialialise TS View. Time Series oldest relation: 2020-12-05T02:17:25.000Z | timestampPath http://www.w3.org/ns/sosa/resultTime | pageSize 10.
// 2023-03-01T09:31:17.604Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 3 (layer size: 5 | amount of nodes from root: 5)
// 2023-03-01T09:31:18.218Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 4 (layer size: 5 | amount of nodes from root: 5)
// 2023-03-01T09:31:21.251Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 5 (layer size: 5 | amount of nodes from root: 5)
// 2023-03-01T09:31:47.013Z [TSMongoDBIngestorBTREE] info: A new layer is added as the root points to too many nodes: depth of tree: 6 (layer size: 5 | amount of nodes from root: 5)
// 2023-03-01T09:32:17.088Z [TSMongoDBIngestorBTREE] closing connection to the Mongo Database.
