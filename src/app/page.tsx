import Link from "next/link";

const features = [
  {
    title: "Trim",
    description: "Cut and splice your videos with frame-precise accuracy.",
  },
  {
    title: "Transcribe",
    description: "Auto-generate captions and transcripts powered by AI.",
  },
  {
    title: "Highlight",
    description: "Detect and clip the best moments automatically.",
  },
  {
    title: "Export",
    description: "Export in multiple formats optimized for every platform.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <section className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4">
          ClipCrafter
        </h1>
        <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-md">
          AI-powered video tools for creators
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Link
            href="/sign-up"
            className="rounded-lg bg-violet-600 px-8 py-3 font-semibold hover:bg-violet-500 transition-colors text-center"
          >
            Get Started
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-gray-700 px-8 py-3 font-semibold hover:border-gray-500 transition-colors text-center"
          >
            Sign In
          </Link>
        </div>
      </section>

      <section className="py-12 px-6">
        <div className="mx-auto max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-xl bg-gray-900 border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
