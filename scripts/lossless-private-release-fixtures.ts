export type IndependentPrivateReleasePackageFixture = {
  name: string
  version: string
  integrity: string
}

export type IndependentPrivateReleaseFixture = {
  version: string
  sourceCommit: string
  packages: readonly IndependentPrivateReleasePackageFixture[]
}

export const INDEPENDENT_PRIVATE_RELEASE_FIXTURES: readonly IndependentPrivateReleaseFixture[] = [
  {
    version: '7.8.0-lossless.5',
    sourceCommit: 'f98f2e0f42cd7d9d9556567f9236c98eed00da16',
    packages: [
      {
        name: '@prisma-lossless/debug',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-f8g63A0ARkt2+GCgRpiA09mxDgXjzU/EATxcA0ebSQOtDbhReQDri7n7m6b3u8XZfugxZYt4ZE5W32wAg2pANQ==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-Ow22QHvHic7XNSozhTgreG6/KO5ZT4PO5NjOyxQP9Es/dgbeU9QXrPWFHJgCgn1FMv1zkISBZQqU+Iw01o4XAQ==',
      },
      {
        name: '@prisma-lossless/get-platform',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-toOrsnC4yoSJW6C+n2uKhdKj3yW7ZMX5e6WhJ4TBKD2Cp8/xOyB2qJ3vdrZbSV4T4oSzWMK/2dyeeHR1VmFgZg==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-WVBGYupq9SSoNfzeoMU0tlERfiMvgLMRH/KazW9Jbkz3GzaNxiXGWfK2n1/a+nlBb5UoarmwlnAeslVvkcxWvg==',
      },
      {
        name: '@prisma-lossless/engines',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-4odujRKCFlmBSxyGadjOBLhTcfhUPStW3CYlZ8iQRzGR0l851aZoGbrGu05Cd6eX2BrWqBcMNZv8azb+Bw5CKg==',
      },
      {
        name: '@prisma-lossless/config',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-0CvTZ2Z0a3EO0N6RTTgbZPkDFHdqizqzLe4pgyTguv4VlIIkqle8QN2qE4nBFEmGwKbLjdBGmCs70yFikwByZQ==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-foVxxmGM2AiA6+HWuEd+qktk0e0bz2srWbeI/YFr0zoZ9dlMOJgMDNEY/tPz8kaKEYX2E7mJ1XOTSKeG/FB2rA==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-eUjSlk+HmsRVDTpYfP8K/cbxbr2YQtiDpwkvbkCq637itkl8RSSlbKmkJAl+8/XN3tHjBQtKXYymlQj3Mqt09g==',
      },
      {
        name: '@prisma-lossless/client',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-UihOGAfSMX6aI3RNROnr05dGEUkG1PsVVLh2YOtKJ7wTNEe1rVfuv2/sDdV+6BjARp9DTHfpmpPzGa+hGXy51w==',
      },
      {
        name: 'prisma-lossless',
        version: '7.8.0-lossless.5',
        integrity: 'sha512-fj66iWLeEPNJv86rgPP6gNn7JAGMxStypHohKz7mU5ujhF5ZxsJA34VJr2MJf4ovfRV5nkboqRJM8+GIIGhmAA==',
      },
    ],
  },
  {
    version: '7.8.0-lossless.6',
    sourceCommit: 'f98f2e0f42cd7d9d9556567f9236c98eed00da16',
    packages: [
      {
        name: '@prisma-lossless/debug',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-vnOk4JguCs8zTwkESpJHcAr8+wfwPVxmL/nsUBHFFSrlVF0FFUBX3AXvqlEdO8SGNsIa+mhF1vvuEpYYKU6Fmg==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-TnSHKUXAb9PRZxHjgBwr5ZXkuKpNZlkhMfltUD4cbngiMEWFKlo13KBPrGEWFciKOosviRS9uAAVdC9Gzo8Seg==',
      },
      {
        name: '@prisma-lossless/get-platform',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-a9N2yUHDIiHA92YmQjVbiRxcqmnE2EdO3+/2ygmznRKawCgUIHYNYFNCLw3mbalhy/s9SreIZMf2lyDRBKE6Zw==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-AXLJMoUJx30K0daMiW928NS9YGH2KWiL2fyUd+f8tE82r6yzW5KPBb3BDPpqWv3ww4DyQK8Hm8pYhdT9pirBAA==',
      },
      {
        name: '@prisma-lossless/engines',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-Vlo2R8L42kt5IPhiIlrTX3DESpmHlkS3YGDK1UhcVZ2vbMsUfp7Ym0GO604ffvFgPTD4ebe9d6JvqYtpaJrfFw==',
      },
      {
        name: '@prisma-lossless/config',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-rtXgteUdVx998rJNZnzf00zBJiccASqzasMyGTUYU0W+iCNFwaGI7c/DfBGz11LMK7xtbefQD42DpBAF1tTW2g==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-8p+OF0JH7O/8mLdSWybQ4EWgR6L0k/wkgIMO4gyfQaGMDVX3pPlCOqfeKUNfZA/DZaOz9xlntCHf4O3XxOEaKg==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-GWYnZnTl5QnVh91oecYc/HGthy2Pb0cwLhPpZ6pLHKNArQCAXdfViGjgI/T9YjPV5PgQi8jj8k8YaA7GH5HLTA==',
      },
      {
        name: '@prisma-lossless/client',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-NEqO6v44KtU8aWf6qKGsZliWGf4kaHtK8+BCLKHqQjCjcuUS8GIYNJOBi7eiKzLxqJkyNRCEkHBowuxCca3QFQ==',
      },
      {
        name: 'prisma-lossless',
        version: '7.8.0-lossless.6',
        integrity: 'sha512-3cxuvBiqwiMlLHXYIem/opHW3qb+DXtJNPCPyA+ohjlMzF1q59BybfImQt/wgUw6w1lgK6i5W8PZ42coIB3H/g==',
      },
    ],
  },
]

export function readIndependentPrivateReleaseFixture(version: string): IndependentPrivateReleaseFixture {
  const fixture = INDEPENDENT_PRIVATE_RELEASE_FIXTURES.find((candidate) => candidate.version === version)

  if (!fixture) {
    throw new Error(`No independent private release fixture is recorded for ${version}`)
  }

  return fixture
}
