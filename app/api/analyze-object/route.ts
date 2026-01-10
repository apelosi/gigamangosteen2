import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextResponse } from "next/server"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "")

export async function POST(request: Request) {
    try {
        const { imageBase64 } = await request.json()

        if (!imageBase64) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 })
        }

        // Use Gemini 2.0 Flash to analyze the image and generate description and memory
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" })

        const prompt = `You are analyzing a photo to identify and describe the MAIN OBJECT only.

CRITICAL INSTRUCTIONS:
- Focus ONLY on the primary/main object in the image
- IGNORE any humans, hands, fingers, or body parts in the image - do not mention them at all
- IGNORE any other objects in the background or surrounding the main object
- If part of the object is obscured or cut off, you may briefly note which part is not visible
- If the lighting is very dim, you may note that the image is dimly lit
- Describe the object itself in detail: its colors, materials, textures, wear patterns, distinguishing features

Please provide:
1. A detailed description of the main object (2-3 sentences focusing solely on the object's physical characteristics)
2. A nostalgic memory associated with this type of object (3-4 sentences)

Return your response as JSON with this exact structure:
{
  "description": "detailed description of the object here",
  "memory": "nostalgic memory here"
}

Make the memory personal and evocative, as if recalling a specific moment from the past.`

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

        return NextResponse.json({
            description: data.description || "",
            memory: data.memory || "",
        })
    } catch (error) {
        console.error("Error analyzing object:", error)
        return NextResponse.json(
            { error: "Failed to analyze object" },
            { status: 500 }
        )
    }
}
