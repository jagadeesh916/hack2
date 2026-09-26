import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <nav className="bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-700">NoteHub</span>
          <div className="flex gap-3">
            <Link to="/auth">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full mb-6 font-medium">
          ✨ AI-powered study tool
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
          Turn raw notes into<br />
          <span className="text-blue-600">flashcards & stories</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Paste your study notes. NoteHub generates flip-card flashcards and a mnemonic story
          — tailored to your English level — so you remember more, faster.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/auth">
            <Button size="lg" className="text-base px-8">Start for Free →</Button>
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid sm:grid-cols-3 gap-6 mt-20 text-left">
          {[
            {
              icon: '🃏',
              title: 'Smart Flashcards',
              desc: 'Click-to-flip cards generated from your actual notes. No re-typing.',
            },
            {
              icon: '🧠',
              title: 'Mnemonic Story',
              desc: 'A short story weaving all key concepts together — sticks in your memory.',
            },
            {
              icon: '🍴',
              title: 'Share & Fork',
              desc: 'Share a public link. Friends can fork your note set into their account.',
            },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center text-xs text-gray-400 pb-8">
        Built for a hackathon • NoteHub 2024
      </footer>
    </div>
  )
}
