export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const response = await fetch(
      "https://www.bayar.gg/api/create-payment.php",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": process.env.VITE_BAYAR_GG_API_KEY,
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await response.json();

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
}
