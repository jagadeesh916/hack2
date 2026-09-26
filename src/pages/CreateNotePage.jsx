import { useState, useRef } from 'react'
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
import { extractTextFromPDF } from '../lib/pdfExtract'
import toast from 'react-hot-toast'

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL

export default function CreateNotePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [title, setTitle] = useState('')
  const [rawNotes, setRawNotes] = useState('')
  const [englishLevel, setEnglishLevel] = useState('intermediate')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfName, setPdfName] = useState('')

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF must be under 10MB')
      return
    }

    setPdfLoading(true)
    setPdfName(file.name)
    try {
      const text = await extractTextFromPDF(file)
      if (!text.trim()) {
        toast.error('Could not extract text from this PDF (may be scanned/image-based)')
        return
      }
      setRawNotes(text.trim())
      // Auto-fill title from filename if empty
      if (!title) {
        setTitle(file.name.replace(/\.pdf$/i, ''))
      }
      toast.success(`Extracted ${text.split(/\s+/).length} words from PDF`)
    } catch (err) {
      console.error('PDF extract error:', err)
      toast.error('Failed to read PDF: ' + (err.message || 'Unknown error'))
    } finally {
      setPdfLoading(false)
    }
  }

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

      setStatusMsg('Calling AI — generating flashcards & story…')
      const { data: { session } } = await supabase.auth.refreshSession()
      const accessToken = session?.access_token

      const fnRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/generate-notes`, {
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
      })

      if (!fnRes.ok) {
        const errBody = await fnRes.text()
        throw new Error(`Generation failed: ${errBody}`)
      }

      const result = await fnRes.json()

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
            <CardTitle>Paste Notes or Upload a PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* PDF Upload */}
              <div
                onClick={() => !pdfLoading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors
                  ${pdfLoading ? 'opacity-50 cursor-not-allowed border-gray-200' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
                {pdfLoading ? (
                  <div className="flex items-center justify-center gap-2 text-blue-600 text-sm">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Extracting text from PDF…
                  </div>
                ) : pdfName ? (
                  <div className="text-sm text-gray-600">
                    <span className="text-green-600 font-medium">✓ {pdfName}</span>
                    <span className="text-gray-400 ml-2">— click to replace</span>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      <span className="text-blue-600 font-medium">Upload a PDF</span> to extract notes automatically
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Max 10MB · Text-based PDFs only</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 uppercase tracking-wide">or type / paste notes</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* Title */}
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

              {/* Notes textarea */}
              <div className="space-y-1.5">
                <Label htmlFor="raw_notes">
                  Notes
                  {rawNotes && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      {rawNotes.split(/\s+/).filter(Boolean).length} words
                    </span>
                  )}
                </Label>
                <Textarea
                  id="raw_notes"
                  placeholder="Paste your study notes here, or upload a PDF above…"
                  value={rawNotes}
                  onChange={e => setRawNotes(e.target.value)}
                  className="min-h-[180px]"
                  required
                />
              </div>

              {/* English level */}
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
                  <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{statusMsg || 'Generating…'}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || pdfLoading} size="lg">
                {loading ? 'Generating…' : 'Generate Flashcards & Story'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
