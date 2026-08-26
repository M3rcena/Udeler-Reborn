import React from 'react'
import { EnglishUS } from '../locales/EnglishUS'

export type DefaultSchema = typeof EnglishUS

export type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: K extends '_meta'
        ? never
        : T[K] extends object
          ? `${K}.${NestedKeyOf<T[K]>}`
          : `${K}`
    }[keyof T & string]
  : never

export type PathValue<T, P extends string> = P extends `${infer Head}.${infer Tail}`
  ? Head extends keyof T
    ? PathValue<T[Head], Tail>
    : never
  : P extends keyof T
    ? T[P]
    : never

export type ExtractPlaceholders<S extends string> =
  S extends `${string}{{${infer Param}}}${infer Rest}`
    ? (Param extends `{${infer Inner}}` ? Inner : Param) | ExtractPlaceholders<Rest>
    : never

export type TranslationParamValue = React.ReactNode

export type TranslationArgs<P extends string> =
  PathValue<DefaultSchema, P> extends string
    ? [ExtractPlaceholders<PathValue<DefaultSchema, P>>] extends [never]
      ? []
      : [params: Record<ExtractPlaceholders<PathValue<DefaultSchema, P>>, TranslationParamValue>]
    : []

export type TypedTFunction = {
  <P extends NestedKeyOf<DefaultSchema>>(path: P, ...args: TranslationArgs<P>): React.ReactNode
} & DefaultSchema
