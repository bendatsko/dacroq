// import Newsletter from "components/page-elements/nav/Newsletter";

import { Container } from './container';

const year = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="mt-28 border-t border-slate-200 py-10">
      <Container>
        <h2 id="footer-heading" className="sr-only">
          Footer
        </h2>

        <div className="mx-auto lg:flex lg:items-center lg:justify-between">
          <p className="mt-3 text-center text-sm leading-6 text-slate-600 lg:mt-0 lg:text-left">
            &copy; {year} Tremor Labs, Inc. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
