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
    replacementVersion: '7.8.0-lossless.12',
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
    replacementVersion: '7.8.0-lossless.12',
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
    replacementVersion: '7.8.0-lossless.12',
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
    status: 'unavailable',
    replacementVersion: '7.8.0-lossless.12',
    unavailableReason:
      'The release was produced from a checkout with a stale ignored ' +
      '@prisma-lossless/get-platform dist chunk and cannot be reproduced ' +
      'from a fresh clean checkout.',
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
  {
    version: '7.8.0-lossless.9',
    sourceCommit: '790912aad9a5a1a562d5038c65d91f70d023de4c',
    status: 'unavailable',
    replacementVersion: '7.8.0-lossless.12',
    unavailableReason:
      'The release reproduced byte-for-byte, but the engines package ' +
      'omitted dist/scripts lifecycle JavaScript files and failed normal install.',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-pG2Hd8Fx4piA8pRYD0pzYikRaV4Uc9Sx7iHo5XzJoxhgVFpsKgQdEiR/8P4EJRrHHwhDe2EZpInKIjAPpX2Ovw==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-zKqRLokSEllGq9s4ITrWnj/oBF8Bzrj1Uq6n2FDA8mIHyt4+hEt5V5qHkbsCaxt3RPcCtLnIUHbx32cTS6+nuw==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-Mo1SE+qx7joSh02/gg4oavvZENx5Gyv6m33E4PEy8HGsjc88TIaI0uxFiF+lbz1ZMnmCVxcXJVE3XDM1PBnF3w==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-SroAXaOe+YxP7Pf4I8dqZb34IDnDADoo8FnMVtuo/WJx3zUxmqqIvDqpSZ3ZVNcgWTmqVnO6AKagZL6CAeZhyg==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-bnu9MPLjJGpt+XdRnxT1mQxsLWWIJVmrLIEutDOEp8OkZwtArXUO5cCoRA3quunlqfOxSZOhFzmAoHStRuC7xw==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-FZxIZLI3rGD6nxBAzQBxqAWKv90twuMZFV0Mtd2iyXkE/tB4votAsb2/GhPMolXZ/cuD2FJKihujgEKmL9atDA==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-9iBUGpk97M6kUtREMgPNAWMu88pYAkjZFaH/k5ZC/dhbX8SAw+kW4kfAmw+hmOKBurxdEo6TgFrsN9u4J4mUdw==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-HCjHHf9H2kFkjRK11mUvzHozEW8ov47t3/icGXXpUA0filhKs3qmhse1296ikfuI11hOE/f4g3QShq7V1CoBOg==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-vPWG12Wj//MfwHPh30z0QXR1E16c1cmChm9ttxcPWCsz2xHioLyazWrrSijR0PZpAcYm4e/Y5OJAXkYqt3S9tA==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-OW8v1bLTH2eIuGkHJQi0lLpy1fiSPqpaL6RE2F9WbWOcg/FUczUl1pPO+ITOokEQz009SoJZULoAzBKDkxdqKw==',
      },
    ],
  },
  {
    version: '7.8.0-lossless.10',
    sourceCommit: '58e63ae633e5efe0dbb379fbce133e13e637f86a',
    status: 'unavailable',
    replacementVersion: '7.8.0-lossless.12',
    unavailableReason:
      'The release was produced by staging metadata from source ' +
      'packages that still used development versions and workspace ' +
      'dependency specifiers. Source package identity is authoritative ' +
      'starting with 7.8.0-lossless.12.',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-sfELdxpxNVmOHVnYEw9yqjEgYBcqqc/8+5zVrdiuQUH582AfWSHpk945s3Ah5Eag1oT/phR5XpO/qhnCc9CFhw==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-b7GKRN7U4tOExz6QpffsjFemIR1/olvXF+4FJG6YgSj86LhgYR7OkdF+7oefjJgFj8x0nCl7fHWJGQ/Sggm/5w==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-I/nh/plOnHJbvDvNupUhn6+5mB3KCaYx+4BN+Ua4NeVWdlFNsJg/HUe9Zb1NxQtqiABU54sAVQULRNIJU/Ui/w==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-H6V4qd31ikPiqcp7fyzf3/vPEKGx/gWNlBeAE6IcPPKxmasHOBZV2/waDOizo4IsV33TyRMkSFIqgrsKAlwBsQ==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-FNl4zmocJ7EbouE31CNcUgaLBJzMy/epqpPHkQ5MY4h4XN9IVLIq1X71l8VSRhu5d8dGqU398/EoFVtVJzEe6A==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-BRjh3qWeYGPHDZe2/XZEHlfDsicJjEJMX8FgP9hN0avxkkB1lsr/0VCSp5CqcJj5Yn7KJIpNMTOcwOZtMQze/Q==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-0z9GZSZYsaLnh0xHfafHAkqkV+lnRUSbEEh0GDg2pW81WiWKS1B7HqkMWIgipSRnW6Bi2d3Q8T5t5SBgfsDFig==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-IvQNcTOAbIc07rspYH5GJXNQppflN5RcjL4m/ijBJBTfKC5sx5ALbO63m7bZLKmMBVy0U/U1raUgrS5RzHV/Rg==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-yTQctWGLDhSGuVarvVnAhldPPiLlfFzgYw5R0FNaY/Jd1rjxuX8dUn2K1FI8cqplljgzS2abK8mWD05wr0XBLA==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-xdqrTXxfOw4d6jAPmo256NNgin2V3MD/DN2zsJnxVKowiHChoUliVLf7hHqrM2LK3fS2a74RfCMU+6+e44Xkxw==',
      },
    ],
  },
  {
    version: '7.8.0-lossless.11',
    sourceCommit: '65e86f5c32ac361ab31ea95967bdac8256cb0775',
    status: 'unavailable',
    replacementVersion: '7.8.0-lossless.12',
    unavailableReason:
      'The public npm release attempt retained the unscoped ' +
      'prisma-lossless CLI package name, which is not owned by the ' +
      '@prisma-lossless npm organization.',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-fmjKOQZWxT/IJ2s7GYEkgmN9cqB6HEarViFMhwuGXhAtnXUTy/bTS28xT8yyBfRpKfNizqAJMFpNxb98mpgzLw==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-YXEPL7Ua22jy1S/QeS4LE07QOBUF+5veU1/Ki1LYBFFSoVWOcJ/tIWKcOuvrSw4DFrz94Ev/oIpY8brq2bdR1w==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-qc8YUQ6PP1Sdb/M1C/JHh2sDXAM1m1btksiRKQLt1pwaht9pen5WWq36DXzDcSM/dlwhmSKicR1PR2N0C3qYYA==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-MmPAUHSuDMmWfDwpe5x5UrxboRrlGLgYyp1SXWF+uJOD/P1iXsVAPJ40zTroXUCqScTqPJCWoUbn7bDQ7LxggQ==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-C/F6Piav1pHQZutHZR9SfJWn7ka2NaWI8nxSc2QyayZGyDu3lE6alfiZ2OwOuLRZa7muaUu2vxcIWuA9iYJi6A==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-bpJqFgHTtmdEysY+qxmOAwmdgbqeJzolHeXDY71ss0sIKjmuStymTPxIoTtLDgy4I9pM5hI0TkENhIaby+t+dQ==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-qUiUk1XMXFPRHILKHtf2FRXB9wc069jUBYqllSu7RxNF8kAT7Z6Se+M4ZmaxkMHBBsRVgzjvKikTmO9sCLI4Pg==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-7wroe4uDLJaX4pHxTCOw2cZXfksyFFaGqf/woQfFW8wG3aTh1GctKf0Y1HNtHFHMIKgRnHDganQ9NUK10Zs6qA==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-ZdCZz2ivmcT0JVvyyRJqBISZgia8rD1dWPwO6/8E1v8RCbvE+tcb+j+hOAqNZUP7UTzqsBS4aljv//C/hjlY4A==',
      },
      {
        name: 'prisma-lossless',
        integrity: 'sha512-0oCj8EQWRz6ixgQQ6hxDMFVyjopsVYFZ+XkMKlU7Kl0lARaQQzAXq3x9gBhOfgCH5ljfJC+h7a1AIsBPwxl3Pg==',
      },
    ],
  },
  {
    version: '7.8.0-lossless.12',
    sourceCommit: 'b2ab5c601d5e894c4a3c80ad8363c89ae7d5dea5',
    status: 'available',
    packages: [
      {
        name: '@prisma-lossless/debug',
        integrity: 'sha512-NHioGmrg2cWh+S+o1coa6cYhTmMSksLzodS3vqI+Pv1Qu7aC4QJTaVhiHeS7rJ85Q3ulwCNSrxShabaawUqEHQ==',
      },
      {
        name: '@prisma-lossless/driver-adapter-utils',
        integrity: 'sha512-CMJLcNAmxvtd4aG8Cbd1nIQWLzEA6FhKbB3VD7C8dFbGvwQmkNrcJUj0lRphTNinSVVaV+KICQ9PbFoGSzS6CQ==',
      },
      {
        name: '@prisma-lossless/get-platform',
        integrity: 'sha512-7z8Wb5VZgMppll33TLan84uXZz0lbtgRxrBhcrhQIvd2j66mnGXIdga4uggj50a8OjO2yRdH1OkQjq21KKPIpg==',
      },
      {
        name: '@prisma-lossless/fetch-engine',
        integrity: 'sha512-OxjtSsKozD6ciO890SRQrrPIfZk+eZNzDnx+HqLhktn7ybXR+n3j8YMdgpwUeLxMjh/7Trvdws52cy+xoS0LQg==',
      },
      {
        name: '@prisma-lossless/engines',
        integrity: 'sha512-yc7AYLKo4AZwsK+vGMCu3NKgjdBvi68BRW0oNUA5JS/0dgypjHjPzmmQi/6XB+SM1UyvxlJGhM4fJUPWWjOFmw==',
      },
      {
        name: '@prisma-lossless/config',
        integrity: 'sha512-QLxXBBVrxYt7sD4dAqByUk/z2KfplNFK4RIRPAHt+2FjYMEGzuLx3aFth97T8T5sYPSVf7YIxEVT2hkwcRqMvA==',
      },
      {
        name: '@prisma-lossless/client-runtime-utils',
        integrity: 'sha512-K9LuDs9d4aCciL8ePTq9S2rFJJy2dJcZaU/XlseNmXQK9BaKWvE+kPbbISGAGqYzbWiZUii89l9HVpJvRbiVIw==',
      },
      {
        name: '@prisma-lossless/adapter-pg',
        integrity: 'sha512-6nbUX3Kzs0oolZhhyyYNxiFnXmboN7SkSb9TJqM3fC7wHVki9w7AoUdBQJqjav2uE7+Y3XiredwCcYKuGXz0iw==',
      },
      {
        name: '@prisma-lossless/client',
        integrity: 'sha512-8mR9AcAWs3nLgTc8+1X7gpMheXkuyqi8jIp/2pUr72n9WahbeWQ31dYYbWKBStd68oRoNzplmnQtzZ4sUt+zeQ==',
      },
      {
        name: '@prisma-lossless/cli',
        integrity: 'sha512-xyop2iOg82IeLsDv8cfeQTcbc5maiM5Z3VFmOrPZkJwoNNGYVwExGAoR2kNcT353rE7rQ3xJ25DIuslfEoRwsg==',
      },
    ],
  },
]
