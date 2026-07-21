import * as DMMF from '@prisma-lossless/dmmf'

export type BaseDMMF = {
  readonly datamodel: Omit<DMMF.Datamodel, 'indexes'>
}
