export as namespace paredit

type ParseOptions = { addSourceForLeafs?: boolean }
export function parse(src: string, options?: ParseOptions): TopLevelNode

interface Range {
    start: number,
    end: number
}

type AST = TopLevelNode | ErrorNode | ListNode | StringNode | SimpleNode
type InnerNode = ErrorNode | ListNode | StringNode | SimpleNode

export interface TopLevelNode extends Range {
    type: 'toplevel',
    errors: ErrorNode[],
    children: InnerNode[]
}

export interface ErrorNode extends Range {
    type: 'error',
    error: string
    open: string,
    close: string,
    children: InnerNode[]
}

export interface ListNode extends Range {
    type: 'list',
    open: string,
    close: string,
    children: InnerNode[]
}

export interface SimpleNode extends Range {
    type: 'number' | 'symbol' | 'char' | 'special' | 'comment',
    source?: string
}

export interface StringNode extends Range {
    type: 'string',
    open: string,
    close: string,
    source?: string
}

export namespace reader {
    export interface Position {
        idx: number,
        column: number,
        row: number
    }

    export interface ReaderError<T> {
        error: string,
        start: Position,
        end: Position,
        children?: (T | number | string | ReaderError<T>)[]
    }

    type Xform<T> = (type: string, read: T[] | number | string | ReaderError<T>,
        start: Position, end: Position, args: { open: string, close: string }) => T

    export function readSeq<T>(src: string, xform: Xform<T>): T[]
    export function readSexp<T>(src: string, xform: Xform<T>): T
}

export namespace navigator {
    export function forwardSexp(ast: AST, idx: number): number
    export function forwardDownSexp(ast: AST, idx: number): number
    export function backwardSexp(ast: AST, idx: number): number
    export function backwardUpSexp(ast: AST, idx: number): number
    export function closeList(ast: AST, idx: number): number
    export function sexpRange(ast: AST, idx: number): [number, number]
    export function sexpRangeExpansion(ast: AST, startIdx: number, endIdx: number): [number, number]
    export function rangeForDefun(ast: AST, idx: number): [number, number]
}

export namespace walk {
    type MatchFunc = (ast: AST) => boolean
    export function hasChildren(ast: AST): boolean
    export function containingSexpsAt(ast: AST, idx: number, matchFunc?: MatchFunc): AST[]
    export function sexpsAt(ast: AST, idx: number, matchFunc?: MatchFunc): AST[]
    export function nextSexp(ast: AST, idx: number, matchFunc?: MatchFunc): AST
    export function prevSexp(ast: AST, idx: number, matchFunc?: MatchFunc): AST
    export function stringify(ast: AST): string
    export function source(src: string, ast: AST): string
}


export namespace editor {
    interface EditorChanges { changes: [string, number, string | number][], newIndex: number }
    interface Indent extends EditorChanges { ast: AST, src: string, idx: number }
    type OpenListArgs = { count?: number, open?: string, close?: string, endIdx?: number, freeEdits?: boolean }
    type CountAndBackwardArgs = { count?: number, backward?: boolean }
    type WrapArgs = { count?: number }
    type SexpBarfArgs = { backward?: boolean }
    type DeleteArgs = { count?: number, backward?: boolean, endIdx?: number, freeEdits?: boolean }
    export function rewrite(ast: AST, nodeToReplace: InnerNode, newNodes: InnerNode[]): AST
    export function openList(ast: AST, src: string, idx: number, args?: OpenListArgs): EditorChanges
    export function spliceSexp(ast: AST, src: string, idx: number): EditorChanges
    export function spliceSexpKill(ast: AST, src: string, idx: number, args?: CountAndBackwardArgs): EditorChanges
    export function splitSexp(ast: AST, src: string, idx: number): EditorChanges
    export function killSexp(ast: AST, src: string, idx: number, args?: CountAndBackwardArgs): EditorChanges
    export function wrapAround(ast: AST, src: string, idx: number, wrapWithStart: string, wrapWithEnd: string, args?: WrapArgs): EditorChanges
    export function closeAndNewLine(ast: AST, src: string, idx: number, close?: string): EditorChanges
    export function barfSexp(ast: AST, src: string, idx: number, args?: SexpBarfArgs): EditorChanges
    export function slurpSexp(ast: AST, src: string, idx: number, args?: CountAndBackwardArgs): EditorChanges
    export function transpose(ast: AST, src: string, idx: number, args?: {}): EditorChanges // args?
    function deleteX(ast: AST, src: string, idx: number, args?: DeleteArgs): EditorChanges
    export { deleteX as delete } // hackish way to export 'delete', which is a reserved word
    export function indentRange(ast: AST, src: string, start: number, end: number): Indent
}

export const specialForms: string[]
