# LDES Timeseries

[![npm](https://img.shields.io/npm/v/@treecg/ldes-timeseries)](https://www.npmjs.com/package/@treecg/ldes-timeseries)

Add members to an LDES Time Series in different kinds of databases.

Databases implemented so far

- [x] MongoDB
- [ ] MongoDB Timeseries (see [RINF-LDES](https://github.com/SEMICeu/RINF-LDES))
- [ ] [InfluxDB](https://www.influxdata.com/)
- [ ] [TimeScaleDB](https://www.timescale.com/): Postgres for time-series
- [ ] [Prometheus](https://prometheus.io/)
- [ ] Apacha Kafka ?
- [ ] Plain file ?

## Ingesting members into a database

### MongoDB

Note: If you don't have MongoDB installed, checkout these [instructions](./documentation/MongoDB.md) for installations.

The following piece of code ingests the some members in a MongoDB. An alternative is to execute `tsc && npx ts-node index.ts` where you cloned this directory.


```javascript
import { extractMembers } from "@treecg/ldes-snapshot";
import { storeFromFile, TSMongoDBIngestor } from "./";

async function main() {
    // load some members
    const fileName = "./data/location-LDES.ttl"
    const ldesIdentifier = "http://localhost:3000/lil/#EventStream"
    const store = await storeFromFile(fileName);
    const members = extractMembers(store, ldesIdentifier);

    const streamIdentifier = "http://example.org/myStream#eventStream"
    const viewDescriptionIdentifier = "http://example.org/myStream#viewDescription"

    const ldesTSConfig = {
        timestampPath: "http://www.w3.org/ns/sosa/resultTime",
        pageSize: 50,
        date: new Date("2022-08-07T08:08:21Z")
    }
    const ingestor = new TSMongoDBIngestor({ streamIdentifier: streamIdentifier, viewDescriptionIdentifier: viewDescriptionIdentifier });

    await ingestor.instantiate(ldesTSConfig);
    await ingestor.publish(members)

    await ingestor.exit();
}
main()

```

Now that there are members and fragmentations stored in the database, they can be hosted using the [LDES Solid Server](https://github.com/TREEcg/ldes-solid-server).

For this you have to run the server with [this config](./ldes-storeConfig/config.json).

```
npx community-solid-server -c ldes-storeConfig/config.json
```

At this point, you can see the LDES at [http://localhost:3000/ldes/example](http://localhost:3000/ldes/example)

#### B+TREE (ish) fragmentation

Instead of having a flat layout, which is achieved with the `TSMongoDBIngestor`, it is also possible to have a B+TREE like fragmentation.

The following piece of code ingests the some members in a MongoDB with a B+TREE like fragmentation.
An alternative is to execute `tsc && npx ts-node index.ts` where you cloned this directory.

```javascript
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

    await ingestor.instantiate(ldesTSConfig);

    await ingestor.publish(members);
    await ingestor.exit();
}
main()
```

This will create a fragmentation of depth 4 (rootNode -> node -> node -> leafNode, where leafNode is a node with members).

Note: it is not a true B+TREE, but a variant that makes appending to it easier.

`m`: layerSize

Differences:
* There is no linked list from leafNode to leafNode.
* Not all leaf-nodes have at least `m/2` children
  * The most recent branch (as seen from root node), have nodes that have at least 1 child node
* Not all leafs have at least `m/2` keys (members)
  * The most recent leaf node has at least 1 member to a maximum of `pageSize`

Similarities:
* All leaf nodes are at the same level (=depth)
* The keys of each node are in ascending order
* Each node has a maximum of `m` children (except the leaf node, which has a maximum of `pageSize` keys (members))
* There are only keys (members) in the leaf nodes

Sources:
* https://www.scaler.com/topics/data-structures/b-tree-in-data-structure/
* https://www.baeldung.com/cs/b-trees-vs-btrees
* https://en.wikipedia.org/wiki/B%2B_tree
* https://en.wikipedia.org/wiki/B-tree
## Progress

* Adding a member to an LDES in mongoDB works using `@treecg/sds-storage-writer-mongo` (see `attempt-ingesting.ts`)
* create a total new LDES in mongoDB using `initialise-LDES.ts`, more specifically the `MongoDBIngestor`
* Create a TS-LDES with the `TSMongoDBIngestor`

## Next steps

* create a total new LDES in mongoDB using `@treecg/sds-storage-writer-mongo`
* maybe add timestamp directly from the member as we are always working with ldes ts? -> where should it be implemented

## Feedback and questions

Do not hesitate to [report a bug](https://github.com/woutslabbinck/LDES-timeseries/issues).

Further questions can also be asked to [Wout Slabbinck](mailto:wout.slabbinck@ugent.be) (developer and maintainer of this repository).
