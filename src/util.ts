import { Quad } from "@rdfjs/types";
import { storeToString, turtleStringToStore } from "@treecg/ldes-snapshot";
import { existsSync, readFileSync } from "fs";
import { Store } from "n3";

export async function storeFromFile(filepath: string): Promise<Store> {
    if (!existsSync(filepath)){
        throw Error("The filepath is invalid.");
    }
    // if the file content is invalid, the method below will throw a
    // different error
    return await turtleStringToStore(readFileSync(filepath, "utf-8"));
}

export function quadsToString(quads: Quad[]):string {
    return storeToString(new Store(quads))
}