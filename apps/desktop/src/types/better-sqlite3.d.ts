declare module "better-sqlite3" {
  namespace Database {
    export interface RunResult {
      changes: number;
      lastInsertRowid: number | bigint;
    }

    export interface Statement<BindParameters extends unknown[] = unknown[]> {
      run(...params: BindParameters): RunResult;
      get(...params: BindParameters): unknown;
      all(...params: BindParameters): unknown[];
      iterate(...params: BindParameters): IterableIterator<unknown>;
      pluck(toggleState?: boolean): this;
      expand(toggleState?: boolean): this;
      raw(toggleState?: boolean): this;
      bind(...params: BindParameters): this;
    }

    export interface Options {
      readonly?: boolean;
      fileMustExist?: boolean;
      timeout?: number;
      verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
      nativeBinding?: string;
    }

    export interface PragmaOptions {
      simple?: boolean;
    }

    export interface Database {
      memory: boolean;
      readonly: boolean;
      open: boolean;
      name: string;
      prepare<BindParameters extends unknown[] = unknown[]>(source: string): Statement<BindParameters>;
      exec(source: string): this;
      pragma(source: string, options?: PragmaOptions): unknown;
      close(): this;
      defaultSafeIntegers(toggleState?: boolean): this;
      backup(destinationFile: string, options?: unknown): Promise<unknown>;
      serialize(options?: unknown): Buffer;
      function(name: string, cb: (...args: unknown[]) => unknown): this;
      aggregate(name: string, options: unknown): this;
      loadExtension(path: string): this;
    }
  }

  const Database: {
    new (filename: string | Buffer, options?: Database.Options): Database.Database;
    (filename: string | Buffer, options?: Database.Options): Database.Database;
  };

  export = Database;
}
