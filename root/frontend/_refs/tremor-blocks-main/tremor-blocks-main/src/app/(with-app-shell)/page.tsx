'use client';

import React from 'react';
import { blocksCategoriesMetadata } from '@/content/blocks-categories';
import Balancer from 'react-wrap-balancer';

import { Container } from '@/app/ui/container';

import { Label } from '@/components/Label';
import { Switch } from '@/components/Switch';

import BlocksGridTile from '../ui/blocks-grid-tile';

export default function Page() {
  const [showChartsOnly, setShowChartsOnly] = React.useState(false);
  return (
    <Container>
      <div id="blocks-header" className="mt-8 sm:mt-16">
        <h2 className="font-semibold leading-7 text-blue-500">Tremor Blocks</h2>
        <h1 className="mt-4 max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Blocks Categories
        </h1>
        <p className="mt-4 max-w-5xl leading-7 text-slate-600 sm:text-lg sm:leading-8">
          <span className="hidden sm:block">
            <Balancer>
              Tremor Blocks are based on real-world situations. Find inspiration
              for your next dashboard by using our carefully crafted blocks.
            </Balancer>
          </span>
          <span className="sm:hidden">
            Tremor is based on real-world situations. Find inspiration for your
            next dashboard by using our carefully crafted blocks.
          </span>
        </p>
      </div>
      <div className="mt-16 flex items-center justify-end gap-2">
        <Label htmlFor="charts-only">Display only categories with charts</Label>
        <Switch
          id="charts-only"
          checked={showChartsOnly}
          onCheckedChange={() => setShowChartsOnly(!showChartsOnly)}
        />
      </div>
      <ul
        id="blocks-grid"
        className="relative mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3"
      >
        {blocksCategoriesMetadata
          .filter(
            (blocksCategory) => !showChartsOnly || blocksCategory.hasCharts,
          )
          .map((blocksCategory) => (
            <li key={blocksCategory.id}>
              <BlocksGridTile
                id={blocksCategory.id}
                name={blocksCategory.name}
                thumbnail={blocksCategory.thumbnail}
                count={blocksCategory.count}
              />
            </li>
          ))}
      </ul>
    </Container>
  );
}
