/*
Copyright 2020 Bruno Windels <bruno@windels.cloud>
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import {BaseObservableList} from "./BaseObservableList";

/**
 * @license
 * Based off baseSortedIndex function in Lodash <https://lodash.com/>
 * Copyright JS Foundation and other contributors <https://js.foundation/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */
export function sortedIndex<T>(array: T[], value: T, comparator: (left: T, right: T) => number): number {
    let low = 0;
    let high = array.length;

    while (low < high) {
        let mid = (low + high) >>> 1;
        let cmpResult = comparator(value, array[mid]);

        if (cmpResult > 0) {
            low = mid + 1;
        } else if (cmpResult < 0) {
            high = mid;
        } else {
            low = high = mid;
        }
    }
    return high;
}

/* inline update of item in collection backed by array, without replacing the preexising item */
export function findAndUpdateInArray<T>(predicate: (value: T) => boolean, array: T[], observable: BaseObservableList<T>, updater: (value: T) => any[] | false): boolean {
    const index = array.findIndex(predicate);
    if (index !== -1) {
        const value = array[index];
        // allow bailing out of sending an emit if updater determined its not needed
        const params = updater(value);
        if (params !== false) {
            observable.emitUpdate(index, value, params);
        }
        // found
        return true;
    }
    return false;
}
