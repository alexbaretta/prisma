export type PrivateReleasePackageIdentity = {
  name: string
  integrity: string
}

export type PrivateReleaseIdentity = {
  version: string
  sourceCommit: string
  packages: readonly PrivateReleasePackageIdentity[]
}

export const PRIVATE_RELEASE_IDENTITIES: readonly PrivateReleaseIdentity[] = [
  {
    version: '7.8.0-lossless.5',
    sourceCommit: 'f98f2e0f42cd7d9d9556567f9236c98eed00da16',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-f8g63A0ARkt2+GCgRpiA09mxDgXjzU/EATxcA0ebSQOtDbhReQDri7n7m6b3u8XZfugxZYt4ZE5W32wAg2pANQ==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-Ow22QHvHic7XNSozhTgreG6/KO5ZT4PO5NjOyxQP9Es/dgbeU9QXrPWFHJgCgn1FMv1zkISBZQqU+Iw01o4XAQ==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-toOrsnC4yoSJW6C+n2uKhdKj3yW7ZMX5e6WhJ4TBKD2Cp8/xOyB2qJ3vdrZbSV4T4oSzWMK/2dyeeHR1VmFgZg==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-WVBGYupq9SSoNfzeoMU0tlERfiMvgLMRH/KazW9Jbkz3GzaNxiXGWfK2n1/a+nlBb5UoarmwlnAeslVvkcxWvg==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-4odujRKCFlmBSxyGadjOBLhTcfhUPStW3CYlZ8iQRzGR0l851aZoGbrGu05Cd6eX2BrWqBcMNZv8azb+Bw5CKg==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-0CvTZ2Z0a3EO0N6RTTgbZPkDFHdqizqzLe4pgyTguv4VlIIkqle8QN2qE4nBFEmGwKbLjdBGmCs70yFikwByZQ==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-foVxxmGM2AiA6+HWuEd+qktk0e0bz2srWbeI/YFr0zoZ9dlMOJgMDNEY/tPz8kaKEYX2E7mJ1XOTSKeG/FB2rA==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-eUjSlk+HmsRVDTpYfP8K/cbxbr2YQtiDpwkvbkCq637itkl8RSSlbKmkJAl+8/XN3tHjBQtKXYymlQj3Mqt09g==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-bYNBaEInTymBhOp0CI4vtkmqjE/Wibo7vI8sajeS3Akk141+E/CkK7CgNAVgYAtGqV3yJS9tfqzIFfo29lYnOQ==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-fj66iWLeEPNJv86rgPP6gNn7JAGMxStypHohKz7mU5ujhF5ZxsJA34VJr2MJf4ovfRV5nkboqRJM8+GIIGhmAA==',
      },
    ],
  },
]
