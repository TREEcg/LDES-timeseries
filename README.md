# LDES Timeseries

Add members to an LDES Time Series in different kinds of databases.

Databases implemented so far

- [x] MongoDB
- [ ] MongoDB Timeseries (see [RINF-LDES](https://github.com/SEMICeu/RINF-LDES))
- [ ] [InfluxDB](https://www.influxdata.com/)
- [ ] [TimeScaleDB](https://www.timescale.com/): Postgres for time-series
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


    const sdsIdentifier = "http://example.org/sds"
    const ldesTSConfig = {
        sdsStreamIdentifier: sdsIdentifier,
        timestampPath: "http://www.w3.org/ns/sosa/resultTime",
        pageSize: 50,
        date: new Date("2022-08-07T08:08:21Z")
    }
    const ingestor = new TSMongoDBIngestor({ sdsStreamIdentifier: sdsIdentifier });


    await ingestor.instantiate(ldesTSConfig);
    await ingestor.publish(members)

    await ingestor.exit();
}
main()
```

Now that there are members and fragmentations stored in the database, they can be hosted using the [LDES Solid Server](https://github.com/TREEcg/ldes-solid-server).

For this you have to run the server with [this ldes-config](./ldes-storeConfig/config-ldes.json).

At this point, you can see the LDES at [http://localhost:3000/ldes/example](http://localhost:3000/ldes/example)

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
