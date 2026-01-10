import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(request: Request) {
    try {
        const { imageBase64 } = await request.json()

        if (!imageBase64) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 })
        }

        // Use Gemini 2.0 Flash to analyze the image and generate description
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

        const prompt = `You are analyzing a photo to identify and describe the MAIN OBJECT only.

CRITICAL INSTRUCTIONS:
- Focus ONLY on the primary/main object in the image
- IGNORE any humans, hands, fingers, or body parts in the image - do not mention them at all
- IGNORE any other objects in the background or surrounding the main object
- If part of the object is obscured or cut off, you may briefly note which part is not visible
- If the lighting is very dim, you may note that the image is dimly lit
- Describe the object itself in detail: its colors, materials, textures, wear patterns, distinguishing features

Please provide a detailed description of the main object (2-3 sentences focusing solely on the object's physical characteristics).

Return your response as JSON with this exact structure:
{
  "description": "detailed description of the object here",
  "objectType": "the type of object (e.g., 'coffee mug', 'rolling pin', 'book')"
}

Be specific about the object type so it can be matched against other objects.`

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: "image/png",
                    data: imageBase64,
                },
            },
        ])

        const response = result.response
        const text = response.text()

        // Parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error("Failed to parse JSON from response")
        }

        const data = JSON.parse(jsonMatch[0])
        const newDescription = data.description || ""
        const objectType = data.objectType || ""

        // Now search the database for matching objects using Gemini to compare descriptions
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                description: newDescription,
                objectType: objectType,
                matched: false,
                matchedMemory: null,
                matchedRecord: null,
                error: "Database not configured"
            })
        }

        const supabase = createClient(supabaseUrl, supabaseKey)

        // Fetch all memories from the database
        const { data: memories, error } = await supabase
            .from("object_memories")
            .select("*")
            .neq("object_description", "")
            .order("created_at", { ascending: false })

        if (error) {
            console.error("Error fetching memories:", error)
            return NextResponse.json({
                description: newDescription,
                objectType: objectType,
                matched: false,
                matchedMemory: null,
                matchedRecord: null,
            })
        }

        if (!memories || memories.length === 0) {
            return NextResponse.json({
                description: newDescription,
                objectType: objectType,
                matched: false,
                matchedMemory: null,
                matchedRecord: null,
            })
        }

        // Use Gemini to find the best matching object from the database
        const memoriesForMatching = memories.map((m, i) => ({
            index: i,
            id: m.id,
            description: m.object_description,
            memory: m.object_memory,
        }))

        const matchPrompt = `You are comparing a NEW object description to a list of SAVED object descriptions to find if they describe the SAME physical object (not just the same type of object).

NEW OBJECT DESCRIPTION:
"${newDescription}"

NEW OBJECT TYPE: "${objectType}"

SAVED OBJECTS:
${memoriesForMatching.map(m => `[${m.index}] ID:${m.id} - "${m.description}"`).join("\n\n")}

CRITICAL MATCHING RULES:
1. You are looking for the EXACT SAME physical object, not just objects of the same type
2. Two coffee mugs are NOT a match unless they have the same specific details (same color, same wear patterns, same distinguishing features)
3. Look for matching specific details: colors, materials, wear patterns, scratches, stains, unique features
4. The descriptions must describe what appears to be the SAME individual item

Return JSON with this structure:
{
  "matchFound": true/false,
  "matchIndex": <index number if match found, or -1 if no match>,
  "confidence": "high"/"medium"/"low",
  "reason": "brief explanation of why this is or isn't a match"
}

Only return matchFound: true if you are confident this is the SAME physical object based on specific details, not just a similar type of object.`

        const matchResult = await model.generateContent(matchPrompt)
        const matchText = matchResult.response.text()

        const matchJsonMatch = matchText.match(/\{[\s\S]*\}/)
        if (!matchJsonMatch) {
            return NextResponse.json({
                description: newDescription,
                objectType: objectType,
                matched: false,
                matchedMemory: null,
                matchedRecord: null,
            })
        }

        const matchData = JSON.parse(matchJsonMatch[0])

        if (matchData.matchFound && matchData.matchIndex >= 0 && matchData.matchIndex < memoriesForMatching.length) {
            const matchedItem = memoriesForMatching[matchData.matchIndex]
            const fullRecord = memories.find(m => m.id === matchedItem.id)

            return NextResponse.json({
                description: newDescription,
                objectType: objectType,
                matched: true,
                matchedMemory: matchedItem.memory,
                matchedRecord: fullRecord ? {
                    id: fullRecord.id,
                    object_description: fullRecord.object_description,
                    object_memory: fullRecord.object_memory,
                    object_image_base64: fullRecord.object_image_base64,
                    created_at: fullRecord.created_at,
                } : null,
                confidence: matchData.confidence,
                reason: matchData.reason,
            })
        }

        return NextResponse.json({
            description: newDescription,
            objectType: objectType,
            matched: false,
            matchedMemory: null,
            matchedRecord: null,
            reason: matchData.reason,
        })
    } catch (error) {
        console.error("Error matching object:", error)
        return NextResponse.json(
            { error: "Failed to match object" },
            { status: 500 }
        )
    }
}
