import {BaseObservableList} from "./BaseObservableList";

type Filter<V> = (value: V, index: number) => boolean;

export class FilteredList<V> extends BaseObservableList<V> {
    private _source: BaseObservableList<V>;
    private _filter: Filter<V> | null;
    private _included: boolean[] | null = null
    private _subscription: (() => void) | null = null;

    constructor(source: BaseObservableList<V>, filter: Filter<V> | null = null) {
        super();
        this._source = source;
        this._filter = filter;
    }

    setFilter(filter: Filter<V> | null): void {
        this._filter = filter;
        if (this._subscription) {
            this._reapplyFilter();
        }
    }

    private _emitForUpdate(wasIncluded: boolean, isIncluded: boolean, idx: number, value: V, params: any = null): void {

        if (wasIncluded && !isIncluded) {
            this.emitRemove(idx, value);
        } else if (!wasIncluded && isIncluded) {
            this.emitAdd(idx, value);
        } else if (wasIncluded && isIncluded) {
            this.emitUpdate(idx, value, params);
        }
    }

    private _reapplyFilter(silent: boolean = false): void {
        if (this._filter) {
            const oldIncluded = this._included;
            this._included = this._included || new Array<boolean>(this._source.length).fill(false);
            let i = 0, translatedIndex = 0;
            for (const value of this._source) {
                const isIncluded = this._filter(value, i);
                const wasIncluded = oldIncluded ? oldIncluded[i] : true;
                this._included[i] = isIncluded;
                if (!silent) {
                    this._emitForUpdate(wasIncluded, isIncluded, translatedIndex, value);
                }
                if (isIncluded) translatedIndex++;
                i++;
            }
        } else {
            if (!this._included) return;
            let i = 0;
            for (const value of this._source) {
                if (!this._included[i] && !silent) {
                    this.emitAdd(i, value);
                }
                i++;
            }
            this._included = null;
        }
    }

    private _translateIndex(idx: number): number {
        if (!this._included) return idx;
        let i = 0, t = 0;
        while (i < idx) {
            if (this._included[i++]) t++;
        }
        return t;
    }

    onAdd(idx: number, value: V): void {
        if (this._filter) {
            const included = this._filter(value, idx);
            this._included?.splice(idx, 0, included)
            if (!included) {
                return;
            }
        }
        this.emitAdd(this._translateIndex(idx), value);
        this._reapplyFilter();
    }

    onRemove(idx: number, value: V): void {
        const wasIncluded = !this._filter || this._included![idx];
        const translatedIndex = this._translateIndex(idx);
        this._included?.splice(idx, 1);
        if (wasIncluded) {
            this.emitRemove(translatedIndex, value);
        }
        this._reapplyFilter();
    }

    onUpdate(idx: number, value: V, params: any): void {
        if (!this._included) {
            this.emitUpdate(idx, value, params);
            return;
        }
        const wasIncluded = this._included![idx];
        const isIncluded = this._filter!(value, idx);
        this._included![idx] = isIncluded;
        this._emitForUpdate(wasIncluded, isIncluded, this._translateIndex(idx), value, params);
    }

    onReset(): void {
        this._reapplyFilter();
        this.emitReset();
    }

    onMove(from: number, to: number, value: V): void {
        if (!this._included) {
            this.emitMove(from, to, value);
            return;
        }
        const tfrom = this._translateIndex(from);
        const tto = this._translateIndex(to);

        const wasIncluded = this._included[from];
        const isIncluded = this._filter!(value, to);
        this._included.splice(from, 1);
        this._included.splice(to, 0, isIncluded);
        if (wasIncluded && isIncluded) {
            this.emitMove(tfrom, tto, value);
        } else if (wasIncluded && !isIncluded) {
            this.emitRemove(tfrom, value);
        } else if (!wasIncluded && isIncluded) {
            this.emitAdd(tto, value);
        }
        this._reapplyFilter();
    }

    onSubscribeFirst(): void {
        this._subscription = this._source.subscribe(this);
        this._reapplyFilter(true);
        super.onSubscribeFirst();
    }

    onUnsubscribeLast(): void {
        super.onUnsubscribeLast();
        this._included = null;
        this._subscription!();
        this._subscription = null;
    }

    [Symbol.iterator]() {
        return new FilterIterator(this._source, this._included!);
    }

    get length(): number {
        let count = 0;
        this._included!.forEach(included => {
            if (included) count += 1;
        });
        return count;
    }
}

class FilterIterator<V> {
    private _included: boolean[];
    private _index: number;
    private _sourceIterator: IterableIterator<V>;

    constructor(list: BaseObservableList<V>, included: boolean[]) {
        this._included = included;
        this._index = 0;
        this._sourceIterator = list[Symbol.iterator]();
    }

    next() {
        while(true) {
            const sourceResult = this._sourceIterator.next();
            if (sourceResult.done) {
                return sourceResult;
            }
            const idx = this._index++;
            if (this._included[idx]) {
                return sourceResult;
            }
        }
    }
}
