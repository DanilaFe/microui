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

import {BaseMappedList, runAdd, runUpdate, runRemove, runMove, runReset} from "./BaseMappedList.js";

export class MappedList<F,T> extends BaseMappedList<F,T> {
    onSubscribeFirst() {
        this._sourceUnsubscribe = this._sourceList.subscribe(this);
        this._mappedValues = [];
        for (const item of this._sourceList) {
            this._mappedValues.push(this._mapper(item));
        }
    }

    onReset() {
        runReset(this);
    }

    onAdd(index: number, value: F): void {
        const mappedValue = this._mapper(value);
        runAdd(this, index, mappedValue);
    }

    onUpdate(index: number, value: F, params: any | false): void {
        // if an update is emitted while calling source.subscribe() from onSubscribeFirst, ignore it
        if (!this._mappedValues) {
            return;
        }
        runUpdate(this, index, value, params);
    }

    onRemove(index: number): void {
        runRemove(this, index);
    }

    onMove(fromIdx: number, toIdx: number): void {
        runMove(this, fromIdx, toIdx);
    }

    onUnsubscribeLast() {
        this._sourceUnsubscribe?.();
    }
}

import {ObservableArray} from "./ObservableArray.js";
import {BaseObservableList, IObservableListHandler} from "./BaseObservableList.js";

export async function tests() {
    class MockList extends BaseObservableList<number> {
        get length() {
            return 0;
        }
        [Symbol.iterator]() {
            return [].values();
        }
    }

    type MappedType = { n: number, m?: number }

    return {
        test_add(assert) {
            const source = new MockList();
            const mapped = new MappedList<number, MappedType>(source, n => {return {n: n*n};});
            let fired = false;
            const unsubscribe = mapped.subscribe({
                onAdd(idx: number, value: MappedType) {
                    fired = true;
                    assert.equal(idx, 0);
                    assert.equal(value.n, 36);
                }
            } as any as IObservableListHandler<MappedType>);
            source.emitAdd(0, 6);
            assert(fired);
            unsubscribe();
        },
        test_update(assert) {
            const source = new MockList();
            const mapped = new MappedList<number, MappedType>(
                source,
                n => {return {n: n*n};},
                (o, p, n) => o.m = n*n
            );
            let fired = false;
            const unsubscribe = mapped.subscribe({
                onAdd() {},
                onUpdate(idx, value) {
                    fired = true;
                    assert.equal(idx, 0);
                    assert.equal(value.n, 36);
                    assert.equal(value.m, 49);
                }
            } as any as IObservableListHandler<MappedType>);
            source.emitAdd(0, 6);
            source.emitUpdate(0, 7);
            assert(fired);
            unsubscribe();
        },
        "test findAndUpdate not found": assert => {
            const source = new ObservableArray([1, 3, 4]);
            const mapped = new MappedList(
                source,
                n => {return n*n;}
            );
            mapped.subscribe({
                onUpdate() { assert.fail(); }
            } as any as IObservableListHandler<number>);
            assert.equal(mapped.findAndUpdate(
                n => n === 100,
                () => assert.fail()
            ), false);
        },
        "test findAndUpdate found but updater bails out of update": assert => {
            const source = new ObservableArray([1, 3, 4]);
            const mapped = new MappedList(
                source,
                n => {return n*n;}
            );
            mapped.subscribe({
                onUpdate() { assert.fail(); }
            } as any as IObservableListHandler<number>);
            let fired = false;
            assert.equal(mapped.findAndUpdate(
                n => n === 9,
                n => {
                    assert.equal(n, 9);
                    fired = true;
                    return false;
                }
            ), true);
            assert.equal(fired, true);
        },
        "test findAndUpdate emits update": assert => {
            const source = new ObservableArray([1, 3, 4]);
            const mapped = new MappedList(
                source,
                n => {return n*n;}
            );
            let fired = false;
            mapped.subscribe({
                onUpdate(idx, n, params) {
                    assert.equal(idx, 1);
                    assert.equal(n, 9);
                    assert.equal(params, "param");
                    fired = true;
                }
            } as any as IObservableListHandler<number>);
            assert.equal(mapped.findAndUpdate(n => n === 9, () => "param"), true);
            assert.equal(fired, true);
        },
        
    };
}
