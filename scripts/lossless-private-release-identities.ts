export type PrivateReleasePackageIdentity = {
  name: string
  integrity: string
}

export type PrivateReleaseIdentity = {
  version: string
  sourceCommit: string
  status?: 'available' | 'unavailable'
  replacementVersion?: string
  unavailableReason?: string
  packages: readonly PrivateReleasePackageIdentity[]
}

export const PRIVATE_RELEASE_IDENTITIES: readonly PrivateReleaseIdentity[] = [
  {
    version: '7.8.0-lossless.5',
    sourceCommit: 'f98f2e0f42cd7d9d9556567f9236c98eed00da16',
    status: 'unavailable',
    replacementVersion: '7.8.0-lossless.8',
    unavailableReason:
      'The historical client tarball integrity is known from the GWEN lockfile, ' +
      'but the current built graph cannot reproduce those package bytes.',
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
        integrity: 'sha512-UihOGAfSMX6aI3RNROnr05dGEUkG1PsVVLh2YOtKJ7wTNEe1rVfuv2/sDdV+6BjARp9DTHfpmpPzGa+hGXy51w==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-fj66iWLeEPNJv86rgPP6gNn7JAGMxStypHohKz7mU5ujhF5ZxsJA34VJr2MJf4ovfRV5nkboqRJM8+GIIGhmAA==',
      },
    ],
  },
  {
    version: '7.8.0-lossless.6',
    sourceCommit: 'f98f2e0f42cd7d9d9556567f9236c98eed00da16',
    status: 'unavailable',
    replacementVersion: '7.8.0-lossless.8',
    unavailableReason:
      'The release installed with correct package metadata, but generated ' +
      'clients still carried the development version placeholder.',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-vnOk4JguCs8zTwkESpJHcAr8+wfwPVxmL/nsUBHFFSrlVF0FFUBX3AXvqlEdO8SGNsIa+mhF1vvuEpYYKU6Fmg==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-TnSHKUXAb9PRZxHjgBwr5ZXkuKpNZlkhMfltUD4cbngiMEWFKlo13KBPrGEWFciKOosviRS9uAAVdC9Gzo8Seg==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-a9N2yUHDIiHA92YmQjVbiRxcqmnE2EdO3+/2ygmznRKawCgUIHYNYFNCLw3mbalhy/s9SreIZMf2lyDRBKE6Zw==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-AXLJMoUJx30K0daMiW928NS9YGH2KWiL2fyUd+f8tE82r6yzW5KPBb3BDPpqWv3ww4DyQK8Hm8pYhdT9pirBAA==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-Vlo2R8L42kt5IPhiIlrTX3DESpmHlkS3YGDK1UhcVZ2vbMsUfp7Ym0GO604ffvFgPTD4ebe9d6JvqYtpaJrfFw==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-rtXgteUdVx998rJNZnzf00zBJiccASqzasMyGTUYU0W+iCNFwaGI7c/DfBGz11LMK7xtbefQD42DpBAF1tTW2g==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-8p+OF0JH7O/8mLdSWybQ4EWgR6L0k/wkgIMO4gyfQaGMDVX3pPlCOqfeKUNfZA/DZaOz9xlntCHf4O3XxOEaKg==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-GWYnZnTl5QnVh91oecYc/HGthy2Pb0cwLhPpZ6pLHKNArQCAXdfViGjgI/T9YjPV5PgQi8jj8k8YaA7GH5HLTA==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-NEqO6v44KtU8aWf6qKGsZliWGf4kaHtK8+BCLKHqQjCjcuUS8GIYNJOBi7eiKzLxqJkyNRCEkHBowuxCca3QFQ==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-3cxuvBiqwiMlLHXYIem/opHW3qb+DXtJNPCPyA+ohjlMzF1q59BybfImQt/wgUw6w1lgK6i5W8PZ42coIB3H/g==',
      },
    ],
  },
  {
    version: '7.8.0-lossless.7',
    sourceCommit: 'de26dd06509902ef202e675bb3eb2d2ee9b7fc4a',
    status: 'unavailable',
    replacementVersion: '7.8.0-lossless.8',
    unavailableReason:
      'The release was produced with random fill-plugin source-map ' +
      'names and cannot be reproduced from a fresh clean checkout.',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-CbQwVaNgGD+QMI+nvmbFZZ7+YVVs0jyhLe5sFRm4VU+ZlNMpMjn1dCeCp3FmztemiRAoLjj/MRTQgFM7eRBDtg==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-LJWEh7v18pR1RUGel8b115bRn1pxkIY1uGOsb2fvcp43/b8+McW2EV6KBDU3NpnjLTxzX6WzqB29vH40TfMdtA==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-k1H+c5eBYZn2m9buHVy5nfa7evMiEc+yRRc8mJZXyg/oBvT8shQfQ32sCBNuzFJMFGgvUXjzjPqzuGsxHxIkhA==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-Ep25kydhl1wz4Fu4VN3lPt182yKnyk35k50hGmKzrSsnkG/Z3+LjnQZ8zFTkh3XN6HZPj01yPet3MOTkAcXDMA==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-1Zz2ky5tbVqaKrg9sQHfbPEvXBFmo0nA8ypV6neBhGM2hdc5Z6lIhH4CCFpd8IaS+hhCju6M/eV7kC+QikIrAQ==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-dFxDUMNdccMLhtDFx0se/Rf7u7YeMGiG9Fm4PVQCgAxvbEHuNyONuXoKTa3ODOyw8WZYnd9PVMSyEDgqVTyFxA==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-pdFPma5Yy/5vGlMFggcxk2/Ps/8LyMqiAMnCo+rUiHJoTXaB1vrCjBgz/gKm9GEvPEqGN4sioHbJn8AVuBZDbw==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-maS90+bMuqmAl/xBoJs4AckEJ+zsaI0Cqh4Uq61ATBP6apaG5zso1vYnidtcd/Apr6nN+YNoQ7YUztNQBDC4fQ==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-/0p3P3MKG2rnQYsGym8dEnCBqLi1W0owvtHEpZj/ue17MU9CgCE1Z2BQb3pnr3LzlC9A++sQ3p8D2jScLdC6eg==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-gqZO9gX2J5rNBp/41xTlc3kiwHcWgQZ1JUCNN4uC5O9b8LWkKruJ6dez41hByJAw2GFW0MY3ByHLJVtTdGVB/Q==',
      },
    ],
  },
  {
    version: '7.8.0-lossless.8',
    sourceCommit: 'e44a7eb72e49bdac92b34f820dee9fbb1248abad',
    status: 'available',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-Eg0gF6hAgWewAzC4AQyEhW4FTH+B0FWpCeNr4I65Xy2AElIJyCu8fb3VHn1bAm7YdXGrUW8HCu6wGcMPAMPdJA==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-6WvYzg/ar7D3C8EGkrnRpm9x4AJOTVhpcXraYXMV+AnBX94WGoDeluTPyUtdeCg3UVvH0R9FP/+0JYc413xTvA==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-8rIe/0K87F4r3JWwhH+Di8lQytavQlIwk6ysPKFKIzJMRNYzmmK/8zPQRFyYiz8T3Rsbz0pPhN/wFkabTnIFqQ==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-r0l/bBJH4n9XfdjzYbxHSJ48Y/pF/Q1KOnbu4wq7NGci4EkpG2dpe7vf1f61xW0nVHXyDNQhw93QpTsJRa7wXw==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-EsDodRL1tncTVr99Xrt9LN52k1oU0JBNZP9wnE1NVuGMGpTo6RHqSni6bxZDfZn2/TdOQXMbMoz3jCg+VtdPcA==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-bGbLoPZTo5Mnqd7FmyLB2qUEmf086aC1lcrwyNX72JkS80ogSarlu0G52bJqUofLN0UUnFqx9BD/4bqWv2oJKg==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-vdjmt3TRDEP2ZwghVabNC2Tbc9uxuYcmxGed5E8eAxCEVSbxDGwEJ9qdAqq0AlQEG0owbuOsZiU4Q5WYfLtTQQ==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-aDjgSurnpycSgTxx8PmJhv+YWb+Ayt5pnhWDB38QD2lW2ski27kT8lPacTKP2GJU6o35bFKPxeY/oUGN7O26qA==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-oMOo4JrmpfqFiXY4ExODCfN+zGGNaU/vBFpmWHisrDCTjrBBlDeAid7hYdJDhoHkZyx36Cj93ntiuslL9NIn7g==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-60SstnN8xZGWy/aWJuP/7WxvYUNtUU07Sbr0jRkWpmEwfhfwgfBuI/PTRy2piotSewDDfC+K0r4Gd2ke22MLwA==',
      },
    ],
  },
]
