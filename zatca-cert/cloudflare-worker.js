// Cloudflare Worker — ZATCA Compliance Onboarding Proxy
// Deploy at: https://workers.cloudflare.com (free, no credit card)

const CSR_BASE64 = "LS0tLS1CRUdJTiBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0KTUlJQlFUQ0I1d0lCQURCVU1Rc3dDUVlEVlFRR0V3SlRRVEVXTUJRR0ExVUVDZ3dOVWxJZ1RVbE1URVZPVGtsVgpUVEVZTUJZR0ExVUVDd3dQTXpFeU5qRXdNRGc1TkRBd01EQXpNUk13RVFZRFZRUUREQXBoYld4aGF5MXdjbTlrCk1GWXdFQVlIS29aSXpqMENBUVlGSzRFRUFBb0RRZ0FFTUpsNTMvdWc2VVAxa3d6Z0pXU0dMZ2s3aXczYzNxMnkKOVJMNEE5WWNON3Y3TFkvMU8xbEJ5RFdPZ0dnanZ3MkpYOW9HZzJ4UWRvTVZCOW5JQ3JxRnRxQTBNRElHQ1NxRwpTSWIzRFFFSkRqRWxNQ013SVFZSkt3WUJCQUdDTnhRQ0JCUVRFbHBCVkVOQkxVTnZaR1V0VTJsbmJtbHVaekFLCkJnZ3Foa2pPUFFRREFnTkpBREJHQWlFQXcrVFRwT1ovajZzbFhCRnprSG9XU2IwRGlpYWxOOFoxaFFyWXRrWFUKVVNnQ0lRRHBWbUxFMnZzRDRqQzMrWCt1aUJJMWVOdVlTUE5MdnA2OEFZRy9iVml5UkE9PQotLS0tLUVORCBDRVJUSUZJQ0FURSBSRVFVRVNULS0tLS0K";

const ZATCA_URL =
  "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal/compliance";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response("POST only", { status: 405 });
    }

    const { otp } = await request.json();
    if (!otp) {
      return new Response(JSON.stringify({ error: "Missing otp" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let zatcaRes;
    try {
      zatcaRes = await fetch(ZATCA_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          OTP: otp,
          "Accept-Version": "V2",
        },
        body: JSON.stringify({ csr: CSR_BASE64 }),
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: "Network error reaching ZATCA", detail: err.message }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await zatcaRes.text();
    return new Response(text, {
      status: zatcaRes.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
