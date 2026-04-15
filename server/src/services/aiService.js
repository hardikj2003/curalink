import axios from "axios";
import { getMedicalData } from "./retrievalService.js";

// -------------------- Helper: Format data for LLM prompts --------------------
function formatDataForLLM(data) {
  const safe = (val) => val || "Not available in provided data";
  let output = "\nPUBLICATIONS:\n";
  data.publications.forEach((p, i) => {
    let snippet = p.snippet || "Not available";
    const maxLen = 400;
    let displaySnippet = snippet;
    if (snippet !== "Not available" && snippet.length > maxLen) {
      displaySnippet = snippet.substring(0, maxLen) + "...";
    }
    output += `
[Study ${i + 1}]
Title: ${safe(p.title)}
Authors: ${safe(p.authors)}
Year: ${safe(p.year)}
Platform: ${safe(p.source)}
Summary: ${displaySnippet}
URL: ${safe(p.url)}
`;
  });
  output += "\nCLINICAL TRIALS:\n";
  data.trials.forEach((t, i) => {
    output += `
[Trial ${i + 1}]
Title: ${safe(t.title)}
Status: ${safe(t.status)}
Eligibility: ${safe(t.eligibility)}
Location: ${safe(t.location)}
Contact: ${safe(t.contact)}
URL: ${safe(t.url)}
`;
  });
  return output;
}

// -------------------- Simplified validation (for the small prompts) --------------------
function validateSimpleResponse(text, requiredKeywords = []) {
  for (const kw of requiredKeywords) {
    if (!text.toLowerCase().includes(kw.toLowerCase())) return false;
  }
  return true;
}

// -------------------- Call Ollama with retry (small prompt version) --------------------
async function callLLMWithRetry(
  prompt,
  model = "llama3.2:3b",
  maxRetries = 2,
  requiredKeywords = [],
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.post(
        `${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}/api/generate`,
        {
          model: model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.85,
            num_predict: 500, // small output
            repeat_penalty: 1.2,
            num_ctx: 2048, // small context to save RAM
          },
        },
        {
          timeout: 60000,
          headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
          },
        },
      );
      const responseText = res.data.response.trim();
      if (
        requiredKeywords.length === 0 ||
        validateSimpleResponse(responseText, requiredKeywords)
      ) {
        return responseText;
      }
      console.warn(`Attempt ${attempt}: missing keywords, retrying...`);
    } catch (err) {
      console.error(`Attempt ${attempt} failed:`, err.message);
      if (attempt === maxRetries) throw err;
    }
  }
  throw new Error("LLM failed after retries");
}

// -------------------- Generate Condition Overview (personalized) --------------------
async function generateConditionOverview(
  patientName,
  disease,
  query,
  researchData,
) {
  const topFindings = researchData.publications
    .slice(0, 2)
    .map((p) => `- ${p.title} (${p.year})`)
    .join("\n");
  const prompt = `
You are CuraLink, a medical assistant. Write 2-3 conversational sentences explaining ${disease} in relation to the user's query: "${query}".

Patient name: ${patientName}
Top recent findings:
${topFindings}

Requirements:
- Personalize for ${patientName} (use "you" or the patient's name).
- Be accurate and based on the findings above.
- Do not hallucinate. If no findings, say "limited data available".

Output only the sentences, no extra text.
`;
  try {
    return await callLLMWithRetry(prompt, "llama3.2:3b", 2, []);
  } catch (err) {
    console.warn("Fallback condition overview");
    return `${disease} is a condition that affects ${patientName}. Based on your interest in "${query}", current research suggests ongoing advancements. Please consult a healthcare provider for personal advice.`;
  }
}

// -------------------- Generate Key Research Insights (4-6 bullet points) --------------------
async function generateKeyInsights(researchData) {
  const prompt = `
Based on the following research data, produce a section called "Key Research Insights" with 4-6 bullet points.
Each bullet must include a finding and the source (Title | Year). Do not add any other sections.

PUBLICATIONS:
${formatDataForLLM(researchData)}

CLINICAL TRIALS:
${researchData.trials.map((t) => `- ${t.title} (${t.status})`).join("\n")}

Output format (exactly):
- Finding: ... (Title | Year)
- Finding: ... (Title | Year)
`;
  try {
    const response = await callLLMWithRetry(prompt, "llama3.2:3b", 2, [
      "Finding:",
    ]);
    return response;
  } catch (err) {
    console.warn("Fallback key insights");
    return researchData.publications
      .map((p) => `- ${p.title} (${p.year})`)
      .join("\n");
  }
}

// -------------------- Generate Personalized Interpretation --------------------
async function generatePersonalizedInterpretation(
  patientName,
  disease,
  query,
  insights,
  trials,
) {
  const trialsList = trials.map((t) => t.title).join(", ");
  const prompt = `
You are CuraLink. Write 2-3 personalized sentences for ${patientName}, who has ${disease} and asked: "${query}".

Key findings from research:
${insights.slice(0, 300)}

Clinical trials available: ${trialsList || "None"}

Explain what these findings mean specifically for ${patientName}. Be helpful, accurate, and encourage consulting a doctor. Output only the sentences.
`;
  try {
    return await callLLMWithRetry(prompt, "llama3.2:3b", 2, []);
  } catch (err) {
    console.warn("Fallback personalized interpretation");
    return `For ${patientName}, the research suggests evolving treatment options for ${disease}. Discuss these findings with your healthcare team to determine the best approach for your situation.`;
  }
}

// -------------------- Build final response (assembles all sections) --------------------
async function buildFinalResponse(researchData, patientName, disease, query) {
  const pubs = researchData.publications;
  const trials = researchData.trials;

  // 1. Condition Overview (LLM)
  const conditionOverview = await generateConditionOverview(
    patientName,
    disease,
    query,
    researchData,
  );

  // 2. Key Research Insights (LLM)
  const keyInsights = await generateKeyInsights(researchData);

  // 3. Clinical Trials section (from data)
  let trialsSection = "";
  if (trials.length === 0) {
    trialsSection = "No relevant clinical trials found in provided data.";
  } else {
    trialsSection = trials
      .map(
        (t) => `
- **${t.title}**  
  Status: ${t.status}  
  Eligibility: ${t.eligibility}  
  Location: ${t.location}  
  Contact: ${t.contact}  
  Relevance: Related to ${disease}
`,
      )
      .join("\n");
  }

  // 4. Source Attribution (from data) - FIXED: no trailing "..."
  let sourcesSection = "";
  [...pubs, ...trials].forEach((s, i) => {
    let snippet = s.snippet || "Not available";
    const maxLen = 400;
    let displaySnippet = snippet;
    if (snippet !== "Not available" && snippet.length > maxLen) {
      displaySnippet = snippet.substring(0, maxLen) + "...";
    }
    sourcesSection += `${i + 1}. Title: ${s.title}\n   Authors: ${s.authors}\n   Year: ${s.year}\n   Platform: ${s.source}\n   URL: ${s.url}\n   Supporting Snippet: ${displaySnippet}\n\n`;
  });

  // 5. Personalized Interpretation (LLM)
  const personalizedInterpretation = await generatePersonalizedInterpretation(
    patientName,
    disease,
    query,
    keyInsights,
    trials,
  );

  return `
## Condition Overview
${conditionOverview}

## Key Research Insights
${keyInsights}

## Clinical Trials
${trialsSection}

## Source Attribution
${sourcesSection}

## Personalized Interpretation
${personalizedInterpretation}
  `;
}

// -------------------- Main exported function --------------------
export async function generateReasonedResponse(
  userContext,
  conversationHistory = [],
) {
  const { patientName, disease, query, location } = userContext;

  const researchData = await getMedicalData({ disease, query, location });
  const finalResponse = await buildFinalResponse(
    researchData,
    patientName,
    disease,
    query,
  );
  return finalResponse;
}
