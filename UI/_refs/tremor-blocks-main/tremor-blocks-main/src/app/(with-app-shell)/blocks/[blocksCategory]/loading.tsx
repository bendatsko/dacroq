import { Container } from '@/app/ui/container';

export default async function Loading() {
  return (
    <Container>
      <div id="blocks-category-header" className="mt-8 sm:mt-16">
        <h2 className="h-5 w-28 rounded-md bg-slate-100" />
        <div className="mt-2 h-10 w-1/3 max-w-2xl rounded-lg bg-gray-200 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl" />
      </div>
      <div className="mt-20 overflow-hidden px-px pb-px">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="isolate mt-24 overflow-hidden rounded-lg first:mt-0"
          >
            <div className="relative before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent">
              <div className="space-y-6">
                <div className="flex justify-between">
                  <div className="h-10 w-2/5 rounded-lg bg-gray-100"></div>
                  <div className="h-10 w-1/5 rounded-lg bg-gray-100"></div>
                </div>
                <div className="flex h-80 items-end justify-center gap-4 rounded-lg bg-gray-50 p-6" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
