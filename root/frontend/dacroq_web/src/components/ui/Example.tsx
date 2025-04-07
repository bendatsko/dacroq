// 'use client';

import { useState } from 'react';
import { RiAppsFill, RiArrowDownSLine, RiCloseLine } from '@remixicon/react';
import {
  Card,
  Dialog,
  DialogPanel,
  Divider,
  Select,
  SelectItem,
} from '@tremor/react';

export default function Example() {
  const [showDemo, setShowDemo] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      {/* first card only for demo purpose */}
      <Card className="p-0 sm:mx-auto sm:max-w-5xl">
        <form action="#" method="POST">
          <div className="absolute right-0 top-0 pr-3 pt-3">
            <button
              type="button"
              className="rounded-tremor-small p-2 text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content"
              aria-label="Close"
            >
              <RiCloseLine className="size-5 shrink-0" aria-hidden={true} />
            </button>
          </div>
          <div className="border-b border-tremor-border px-6 py-4 dark:border-dark-tremor-border">
            <h3 className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
              Add application
            </h3>
          </div>
          <div className="flex flex-col-reverse md:flex-row">
            <div className="flex flex-col justify-between md:w-80 md:border-r md:border-tremor-border md:dark:border-dark-tremor-border">
              <div className="flex-1 grow">
                <div className="border-t border-tremor-border p-6 dark:border-dark-tremor-border md:border-none">
                  <div className="flex items-center space-x-3">
                    <div className="inline-flex shrink-0 items-center justify-center rounded-tremor-small bg-tremor-background-subtle p-3 dark:bg-dark-tremor-background-subtle">
                      <RiAppsFill
                        className="size-5 text-tremor-content-emphasis dark:text-dark-tremor-content"
                        aria-hidden={true}
                      />
                    </div>
                    <div>
                      <h3 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                        Astro Analytics
                      </h3>
                      <p className="mt-0.5 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                        Lorem ipsum dolor sit amet
                      </p>
                    </div>
                  </div>
                  <Divider />
                  <h4 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                    Description:
                  </h4>
                  <p className="mt-1 text-tremor-default leading-6 text-tremor-content dark:text-dark-tremor-content">
                    Lorem ipsum dolor sit amet, consetetur sadipscing elitr.
                  </p>
                  <h4 className="mt-6 text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                    Supported functionality:
                  </h4>
                  <p className="mt-1 text-tremor-default leading-6 text-tremor-content dark:text-dark-tremor-content">
                    Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed
                    diam nonumy eirmod.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-tremor-border p-6 dark:border-dark-tremor-border">
                <button
                  type="button"
                  className="whitespace-nowrap rounded-tremor-small py-2 text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-tremor-small bg-tremor-brand px-3 py-2 text-center text-tremor-default font-medium text-tremor-brand-inverted shadow-tremor-input hover:bg-tremor-brand-emphasis dark:bg-dark-tremor-brand dark:text-dark-tremor-brand-inverted dark:shadow-dark-tremor-input dark:hover:bg-dark-tremor-brand-emphasis"
                >
                  Connect
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-6 p-6 md:px-6 md:pb-20 md:pt-6">
              <div>
                <div className="flex items-center space-x-3">
                  <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                    1
                  </div>
                  <label
                    htmlFor="connection"
                    className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                  >
                    Choose a connection
                  </label>
                </div>
                <Select
                  name="connection"
                  id="connection"
                  defaultValue="1"
                  className="mt-4 w-full"
                >
                  <SelectItem value="1">postgres_live</SelectItem>
                  <SelectItem value="2">postgres_test</SelectItem>
                  <SelectItem value="3">bigQuery_live</SelectItem>
                </Select>
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                    2
                  </div>
                  <label
                    htmlFor="dataset"
                    className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                  >
                    Select dataset
                  </label>
                </div>
                <Select
                  name="dataset"
                  id="dataset"
                  className="mt-4 w-full"
                  defaultValue="1"
                >
                  <SelectItem value="1">starterkit_sales</SelectItem>
                  <SelectItem value="2">starterkit_ecommerce</SelectItem>
                  <SelectItem value="3">starterkit_logs</SelectItem>
                </Select>
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                    3
                  </div>
                  <label
                    htmlFor="metrics"
                    className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                  >
                    Select metrics to track
                  </label>
                </div>
                <p className="mt-1 text-tremor-label text-tremor-content">
                  Lorem ipsum dolor sit amet, consetetur sadipscing elitr
                </p>
                <Select
                  name="metrics"
                  id="metrics"
                  className="mt-4 w-full"
                  defaultValue="2"
                >
                  <SelectItem value="1">all options</SelectItem>
                  <SelectItem value="2">log & health data</SelectItem>
                  <SelectItem value="3">product usage data</SelectItem>
                </Select>
              </div>
              <div>
                <div className="flex items-center space-x-3">
                  <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                    4
                  </div>
                  <label
                    htmlFor="import-method"
                    className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                  >
                    Select import method
                  </label>
                </div>
                <p className="mt-1 text-tremor-label text-tremor-content">
                  Lorem ipsum dolor sit amet, consetetur sadipscing elitr
                </p>
                <Select
                  name="import-method"
                  id="import-method"
                  className="mt-4 w-full"
                  defaultValue="1"
                >
                  <SelectItem value="1">direct query</SelectItem>
                  <SelectItem value="2">import</SelectItem>
                  <SelectItem value="3">
                    direct query (incremental load)
                  </SelectItem>
                </Select>
              </div>
            </div>
          </div>
        </form>
      </Card>
      <Divider className="mt-12">
        <button
          onClick={() => setShowDemo(!showDemo)}
          type="button"
          className="duration-400 group inline-flex items-center justify-center space-x-2 whitespace-nowrap rounded-full bg-tremor-background-subtle px-3.5 py-1.5 text-tremor-default font-medium text-tremor-content focus-visible:ring-1 focus-visible:ring-offset-1 dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content"
          tabIndex={0}
        >
          <RiArrowDownSLine
            aria-hidden={true}
            className={`-mx-1 size-5 transition-all group-hover:text-tremor-content-emphasis group-hover:dark:text-dark-tremor-content-emphasis ${showDemo ? 'rotate-180' : ''} `}
          />
          <span className="transition-all group-hover:text-tremor-content-emphasis group-hover:dark:text-dark-tremor-content-emphasis">
            {showDemo ? 'Hide Demo' : 'Show Demo'}
          </span>
        </button>
      </Divider>
      {showDemo ? (
        <>
          <div className="flex items-center justify-center py-36">
            <button
              type="button"
              className="whitespace-nowrap rounded-tremor-default bg-tremor-brand px-4 py-2 text-center text-tremor-default font-medium text-tremor-brand-inverted shadow-tremor-input hover:bg-tremor-brand-emphasis dark:bg-dark-tremor-brand dark:text-dark-tremor-brand-inverted dark:shadow-dark-tremor-input dark:hover:bg-dark-tremor-brand-emphasis"
              onClick={() => setIsOpen(true)}
            >
              Show dialog
            </button>
          </div>
          <Dialog
            open={isOpen}
            onClose={() => setIsOpen(false)}
            static={true}
            className="z-[100]"
          >
            <DialogPanel className="overflow-visible p-0 sm:max-w-5xl">
              <form action="#" method="POST">
                <div className="absolute right-0 top-0 pr-3 pt-3">
                  <button
                    type="button"
                    className="rounded-tremor-small p-2 text-tremor-content-subtle hover:bg-tremor-background-subtle hover:text-tremor-content dark:text-dark-tremor-content-subtle hover:dark:bg-dark-tremor-background-subtle hover:dark:text-tremor-content"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close"
                  >
                    <RiCloseLine
                      className="size-5 shrink-0"
                      aria-hidden={true}
                    />
                  </button>
                </div>
                <div className="border-b border-tremor-border px-6 py-4 dark:border-dark-tremor-border">
                  <h3 className="font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                    Add application
                  </h3>
                </div>
                <div className="flex flex-col-reverse md:flex-row">
                  <div className="flex flex-col justify-between md:w-80 md:border-r md:border-tremor-border md:dark:border-dark-tremor-border">
                    <div className="flex-1 grow">
                      <div className="border-t border-tremor-border p-6 dark:border-dark-tremor-border md:border-none">
                        <div className="flex items-center space-x-3">
                          <div className="inline-flex shrink-0 items-center justify-center rounded-tremor-small bg-tremor-background-subtle p-3 dark:bg-dark-tremor-background-subtle">
                            <RiAppsFill
                              className="size-5 text-tremor-content-emphasis dark:text-dark-tremor-content"
                              aria-hidden={true}
                            />
                          </div>
                          <div>
                            <h3 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                              Astro Analytics
                            </h3>
                            <p className="mt-0.5 text-tremor-default text-tremor-content dark:text-dark-tremor-content">
                              Lorem ipsum dolor sit amet
                            </p>
                          </div>
                        </div>
                        <Divider />
                        <h4 className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                          Description:
                        </h4>
                        <p className="mt-1 text-tremor-default leading-6 text-tremor-content dark:text-dark-tremor-content">
                          Lorem ipsum dolor sit amet, consetetur sadipscing
                          elitr.
                        </p>
                        <h4 className="mt-6 text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong">
                          Supported functionality:
                        </h4>
                        <p className="mt-1 text-tremor-default leading-6 text-tremor-content dark:text-dark-tremor-content">
                          Lorem ipsum dolor sit amet, consetetur sadipscing
                          elitr, sed diam nonumy eirmod.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-tremor-border p-6 dark:border-dark-tremor-border">
                      <button
                        type="button"
                        className="whitespace-nowrap rounded-tremor-small py-2 text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                        onClick={() => setIsOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="whitespace-nowrap rounded-tremor-small bg-tremor-brand px-3 py-2 text-center text-tremor-default font-medium text-tremor-brand-inverted shadow-tremor-input hover:bg-tremor-brand-emphasis dark:bg-dark-tremor-brand dark:text-dark-tremor-brand-inverted dark:shadow-dark-tremor-input dark:hover:bg-dark-tremor-brand-emphasis"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 space-y-6 p-6 md:px-6 md:pb-20 md:pt-6">
                    <div>
                      <div className="flex items-center space-x-3">
                        <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                          1
                        </div>
                        <label
                          htmlFor="connection"
                          className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                        >
                          Choose a connection
                        </label>
                      </div>
                      <Select
                        name="connection"
                        id="connection"
                        className="mt-4 w-full"
                        defaultValue="postgres_live"
                      >
                        <SelectItem value="1">postgres_live</SelectItem>
                        <SelectItem value="2">postgres_test</SelectItem>
                        <SelectItem value="3">bigQuery_live</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                          2
                        </div>
                        <label
                          htmlFor="dataset"
                          className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                        >
                          Select dataset
                        </label>
                      </div>
                      <Select
                        name="dataset"
                        id="dataset"
                        className="mt-4 w-full"
                        defaultValue="1"
                      >
                        <SelectItem value="1">starterkit_sales</SelectItem>
                        <SelectItem value="2">starterkit_ecommerce</SelectItem>
                        <SelectItem value="3">starterkit_logs</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                          3
                        </div>
                        <label
                          htmlFor="metrics"
                          className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                        >
                          Select metrics to track
                        </label>
                      </div>
                      <p className="mt-1 text-tremor-label text-tremor-content">
                        Lorem ipsum dolor sit amet, consetetur sadipscing elitr
                      </p>
                      <Select
                        name="metrics"
                        id="metrics"
                        className="mt-4 w-full"
                        defaultValue="2"
                      >
                        <SelectItem value="1">all options</SelectItem>
                        <SelectItem value="2">log & health data</SelectItem>
                        <SelectItem value="3">product usage data</SelectItem>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center space-x-3">
                        <div className="inline-flex size-6 items-center justify-center rounded-tremor-small bg-tremor-background-subtle text-tremor-default text-tremor-content-strong dark:bg-dark-tremor-background-subtle dark:text-dark-tremor-content-strong">
                          4
                        </div>
                        <label
                          htmlFor="import-method"
                          className="text-tremor-default font-medium text-tremor-content-strong dark:text-dark-tremor-content-strong"
                        >
                          Select import method
                        </label>
                      </div>
                      <p className="mt-1 text-tremor-label text-tremor-content">
                        Lorem ipsum dolor sit amet, consetetur sadipscing elitr
                      </p>
                      <Select
                        name="import-method"
                        id="import-method"
                        className="mt-4 w-full [&>*]:z-[200]"
                        defaultValue="1"
                      >
                        <SelectItem value="1">direct query</SelectItem>
                        <SelectItem value="2">import</SelectItem>
                        <SelectItem value="3">
                          direct query (incremental load)
                        </SelectItem>
                      </Select>
                    </div>
                  </div>
                </div>
              </form>
            </DialogPanel>
          </Dialog>
        </>
      ) : null}
    </>
  );
}