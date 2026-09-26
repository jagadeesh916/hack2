import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Label } from '../components/ui/Label'
import { Select } from '../components/ui/Select'
import Navbar from '../components/Navbar'
import toast from 'react-hot-toast'

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL

export default function CreateNotePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [rawNotes, setRawNotes] = useState('')
  const [englishLevel, setEnglishLevel] = useState('intermediate')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim() || !rawNotes.trim()) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    setStatusMsg('Saving your notes…')

    let noteSetId = null
    try {
      // 1. Insert the row first (generated_content = null)
      const { data: inserted, error: insertError } = await supabase
        .from('note_sets')
        .insert({
          owner_id: user.id,
          title: title.trim(),
          raw_notes: rawNotes.trim(),
          english_level: englishLevel,
          generated_content: null,
          is_public: true,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      noteSetId = inserted.id

      // 2. Call the Edge Function to generate content
      setStatusMsg('Calling AI — this may take up to 30 seconds on a cold start…')
      // Always refresh session to avoid JWT expiry errors
      const { data: { session } } = await supabase.auth.refreshSession()
      const accessToken = session?.access_token

      const fnRes = await fetch(
        `${SUPABASE_FUNCTIONS_URL}/generate-notes`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            noteSetId,
            rawNotes: rawNotes.trim(),
            englishLevel,
          }),
        }
      )

      if (!fnRes.ok) {
        const errBody = await fnRes.text()
        throw new Error(`Generation failed: ${errBody}`)
      }

      const result = await fnRes.json()

      if (result.warmingUp) {
        setStatusMsg('Warming up the AI model, one moment…')
        // The edge function handles the wait; this is just a UI hint
      }

      // 3. Update the row with generated_content
      const { error: updateError } = await supabase
        .from('note_sets')
        .update({ generated_content: result.generated_content })
        .eq('id', noteSetId)

      if (updateError) throw updateError

      toast.success('Note set created!')
      navigate(`/notes/${noteSetId}`)
    } catch (err) {
      console.error('Create note error:', err)
      toast.error(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
      setStatusMsg('')
      // If we have a partial row, delete it so the user can retry cleanly
      if (noteSetId) {
        await supabase.from('note_sets').delete().eq('id', noteSetId)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Note Set</h1>
        <Card>
          <CardHeader>
            <CardTitle>Paste Your Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Photosynthesis — Chapter 5"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="raw_notes">Raw Notes</Label>
                <Textarea
                  id="raw_notes"
                  placeholder="Paste your study notes here…"
                  value={rawNotes}
                  onChange={e => setRawNotes(e.target.value)}
                  className="min-h-[200px]"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="level">Your English Level</Label>
                <Select
                  id="level"
                  value={englishLevel}
                  onChange={e => setEnglishLevel(e.target.value)}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </Select>
              </div>

              {loading && (
                <div className="flex items-center gap-3 text-sm text-blue-600 bg-blue-50 rounded-md px-4 py-3">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{statusMsg || 'Generating…'}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? 'Generating…' : 'Generate Flashcards & Story'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
