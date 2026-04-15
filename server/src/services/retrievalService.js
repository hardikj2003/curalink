import axios from "axios";
import xml2js from "xml2js";
import dns from "dns";
import { getEmbedding, cosineSimilarity } from "./embeddingService.js";

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

// -------------------- HELPERS --------------------
const safe = (val) => val || "Not available in provided data";

// -------------------- QUERY EXPANSION (API‑specific) --------------------
function expandForPubMed(disease, query) {
  // Use boolean operators: disease AND (query) AND (treatment OR therapy ...)
  return `${disease} AND (${query}) AND (treatment OR therapy OR "clinical trial" OR mechanism)`;
}

function expandForOpenAlex(disease, query) {
  // Just combine disease + query + keywords
  return `${disease} ${query} treatment therapy "clinical trial"`;
}

function expandForTrials(disease, query) {
  // ClinicalTrials.gov uses separate cond and term
  return { cond: disease, term: query };
}
// -------------------- PAGINATED PUBMED (with retries & error handling) --------------------
async function fetchPubMedDeep(query, maxResults = 150) {
  const maxRetries = 3;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Step 1: get all IDs with pagination
      let allIds = [];
      let retStart = 0;
      const retMax = 50;
      while (allIds.length < maxResults) {
        const searchRes = await axios.get(
          "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
          {
            params: {
              db: "pubmed",
              term: query,
              retstart: retStart,
              retmax: retMax,
              sort: "relevance",
              retmode: "json",
              tool: "curalink", // Identify your tool
              email: "contact@example.com", // NCBI requires email for heavy usage
            },
            timeout: 15000,
            headers: {
              "User-Agent":
                "CuraLink/1.0 (https://curalink.example.com; contact@example.com)",
            },
          },
        );
        const ids = searchRes.data?.esearchresult?.idlist || [];
        if (ids.length === 0) break;
        allIds.push(...ids);
        retStart += retMax;
        if (ids.length < retMax) break;
        // Be polite: small delay between pagination requests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (allIds.length === 0) return [];

      // Step 2: fetch details in batches (NCBI allows up to 200 IDs per request)
      const batchSize = 200;
      const articles = [];
      for (let i = 0; i < allIds.length; i += batchSize) {
        const batchIds = allIds.slice(i, i + batchSize);
        const fetchRes = await axios.get(
          "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
          {
            params: {
              db: "pubmed",
              id: batchIds.join(","),
              retmode: "xml",
            },
            timeout: 20000,
            headers: {
              "User-Agent":
                "CuraLink/1.0 (https://curalink.example.com; contact@example.com)",
            },
          },
        );
        const parsed = await xml2js.parseStringPromise(fetchRes.data, {
          explicitArray: true,
          mergeAttrs: true,
        });
        const batchArticles = (
          parsed?.PubmedArticleSet?.PubmedArticle || []
        ).map((a) => {
          const article = a.MedlineCitation?.[0]?.Article?.[0];

          // Extract PMID safely
          let pmid = null;
          const pmidNode = a.MedlineCitation?.[0]?.PMID?.[0];
          if (typeof pmidNode === "string") {
            pmid = pmidNode;
          } else if (pmidNode && typeof pmidNode === "object") {
            pmid = pmidNode._ || Object.values(pmidNode)[0];
          }
          const url = pmid
            ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
            : "Not available in provided data";

          // Extract abstract
          let abstractText = "Not available in provided data";
          if (article?.Abstract?.[0]?.AbstractText) {
            const abstractNodes = article.Abstract[0].AbstractText;
            abstractText = abstractNodes
              .map((node) => (typeof node === "string" ? node : node._ || ""))
              .join(" ")
              .slice(0, 800);
          }

          // Extract authors
          const authors =
            article?.AuthorList?.[0]?.Author?.map((auth) =>
              `${auth.ForeName?.[0] || ""} ${auth.LastName?.[0] || ""}`.trim(),
            )
              .slice(0, 3)
              .join(", ") || "Not available in provided data";

          // Extract year
          const year =
            article?.Journal?.[0]?.JournalIssue?.[0]?.PubDate?.[0]?.Year?.[0] ||
            "Not available in provided data";

          return {
            title:
              article?.ArticleTitle?.[0] || "Not available in provided data",
            authors,
            year: parseInt(year) || 0,
            source: "PubMed",
            url,
            snippet: abstractText,
          };
        });
        articles.push(...batchArticles);
        // Delay between batches to avoid overwhelming NCBI
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return articles.slice(0, maxResults);
    } catch (err) {
      console.warn(`⚠️ PubMed attempt ${attempt} failed:`, err.message);
      if (attempt === maxRetries) {
        console.warn(
          "⚠️ PubMed deep fetch failed after retries, returning empty array",
        );
        return [];
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return [];
}
// -------------------- PAGINATED OPENALEX (with retries & fallback) --------------------
async function fetchOpenAlexDeep(query, maxResults = 150) {
  const maxRetries = 3;
  let delay = 1000;

  // Sanitize query: remove problematic characters
  const sanitizedQuery = query
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let allWorks = [];
      let page = 1;
      const perPage = 50; // reduced from 100 to avoid 500 errors
      while (allWorks.length < maxResults) {
        const res = await axios.get("https://api.openalex.org/works", {
          params: {
            search: sanitizedQuery,
            per_page: perPage,
            page: page,
            sort: "relevance_score:desc",
          },
          timeout: 15000,
          headers: {
            "User-Agent":
              "CuraLink/1.0 (https://curalink.example.com; contact@example.com)",
          },
        });
        const works = res.data.results || [];
        if (works.length === 0) break;
        const formatted = works.map((w) => ({
          title: w.display_name || "Not available in provided data",
          authors:
            w.authorships
              ?.map((a) => a.author.display_name)
              .slice(0, 3)
              .join(", ") || "Not available in provided data",
          year: w.publication_year || 0,
          source: w.host_venue?.display_name || "OpenAlex",
          url: w.doi || w.id,
          snippet: w.abstract_inverted_index
            ? Object.entries(w.abstract_inverted_index)
                .sort((a, b) => a[1][0] - b[1][0])
                .map(([word]) => word)
                .join(" ")
                .slice(0, 800)
            : "Not available in provided data",
        }));
        allWorks.push(...formatted);
        page++;
        if (works.length < perPage) break;
      }
      if (allWorks.length > 0) return allWorks.slice(0, maxResults);
    } catch (err) {
      console.warn(`⚠️ OpenAlex attempt ${attempt} failed:`, err.message);
      if (attempt === maxRetries) {
        console.warn(
          "⚠️ OpenAlex deep fetch failed after retries, returning empty array",
        );
        return [];
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  return [];
}

// -------------------- PAGINATED CLINICAL TRIALS (up to 100) --------------------
async function fetchTrialsDeep(disease, query, maxResults = 100) {
  try {
    let allTrials = [];
    let pageToken = null;
    const pageSize = 100;
    while (allTrials.length < maxResults) {
      const params = {
        "query.cond": disease,
        "query.term": query,
        pageSize: pageSize,
        format: "json",
      };
      if (pageToken) params.pageToken = pageToken;
      const res = await axios.get("https://clinicaltrials.gov/api/v2/studies", {
        params,
        timeout: 10000,
      });
      const studies = res.data.studies || [];
      if (studies.length === 0) break;
      const formatted = studies.map((s) => {
        const proto = s.protocolSection;
        return {
          title:
            proto?.identificationModule?.officialTitle ||
            proto?.identificationModule?.briefTitle ||
            "Not available in provided data",
          status:
            proto?.statusModule?.overallStatus?.replace(/_/g, " ") || "Unknown",
          eligibility:
            proto?.eligibilityModule?.eligibilityCriteria
              ?.replace(/[\r\n]+/g, " ")
              .slice(0, 500) || "Not available in provided data",
          location:
            proto?.contactsLocationsModule?.locations?.[0]?.facility ||
            "Not available in provided data",
          contact:
            proto?.contactsLocationsModule?.centralContacts?.[0]?.email ||
            "Not available in provided data",
          url: `https://clinicaltrials.gov/study/${proto?.identificationModule?.nctId}`,
          source: "ClinicalTrials.gov",
          year: 2024, // no year in trials, use constant for ranking
        };
      });
      allTrials.push(...formatted);
      pageToken = res.data.nextPageToken;
      if (!pageToken) break;
    }
    return allTrials.slice(0, maxResults);
  } catch (err) {
    console.warn("⚠️ ClinicalTrials deep fetch failed:", err.message);
    return [];
  }
}

// -------------------- HYBRID RANKING (embeddings + recency + source) --------------------
async function rankItems(items, userQuery, disease, location, isTrial = false) {
  if (items.length === 0) return [];

  // Get embedding for the combined query (disease + user query)
  const queryText = `${disease} ${userQuery}`;
  const queryEmbedding = await getEmbedding(queryText);

  // Score each item
  const scored = await Promise.all(
    items.map(async (item) => {
      // 1. Semantic similarity (embedding)
      const itemText = `${item.title} ${item.snippet}`.slice(0, 512);
      let similarity = 0;
      try {
        const itemEmbedding = await getEmbedding(itemText);
        similarity = cosineSimilarity(queryEmbedding, itemEmbedding);
      } catch (e) {
        similarity = 0;
      }

      // 2. Recency boost (0 to 0.3)
      let recencyBoost = 0;
      if (item.year && typeof item.year === "number" && item.year > 2018) {
        recencyBoost = Math.min(0.3, (item.year - 2018) / 20);
      }

      // 3. Source boost (PubMed > OpenAlex, trials get status boost)
      let sourceBoost = 0;
      if (!isTrial) {
        if (item.source === "PubMed") sourceBoost = 0.15;
        else if (item.source === "OpenAlex") sourceBoost = 0.05;
      } else {
        if (item.status && item.status.toLowerCase().includes("recruiting"))
          sourceBoost = 0.2;
      }

      // 4. Location boost (if location matches)
      let locationBoost = 0;
      if (
        location &&
        item.location?.toLowerCase().includes(location.toLowerCase())
      ) {
        locationBoost = 0.1;
      }

      const finalScore =
        similarity * 0.7 + recencyBoost + sourceBoost + locationBoost;
      return { ...item, score: finalScore };
    }),
  );

  return scored.sort((a, b) => b.score - a.score);
}

// -------------------- MAIN EXPORT --------------------
export async function getMedicalData(userContext) {
  const { disease, query, location } = userContext;

  // Expand queries per source
  const pubmedQuery = expandForPubMed(disease, query);
  const openAlexQuery = expandForOpenAlex(disease, query);
  const { cond, term } = expandForTrials(disease, query);

  // Fetch deep candidates (parallel)
  const [pubmedArticles, openAlexArticles, trials] = await Promise.all([
    fetchPubMedDeep(pubmedQuery, 150),
    fetchOpenAlexDeep(openAlexQuery, 150),
    fetchTrialsDeep(cond, term, 100),
  ]);

  // Combine publications
  let allPubs = [...pubmedArticles, ...openAlexArticles];
  if (allPubs.length === 0 && trials.length === 0) {
    throw new Error("No research data available");
  }

  // Rank publications and trials separately
  const rankedPubs = await rankItems(allPubs, query, disease, location, false);
  const rankedTrials = await rankItems(trials, query, disease, location, true);

  // Return top 6 publications and top 3 trials
  return {
    publications: rankedPubs.slice(0, 6),
    trials: rankedTrials.slice(0, 3),
  };
}
