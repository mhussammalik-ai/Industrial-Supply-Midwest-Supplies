// Optional: looks up approximate visitor location from their IP address using
// the free tier of ip-api.com (no key required, ~45 requests/minute limit).
// Only runs when ENABLE_IP_GEOLOCATION=true in .env.

async function lookupLocation(ip) {
  if (process.env.ENABLE_IP_GEOLOCATION !== 'true') {
    return { country: null, region: null, city: null };
  }

  // Local/private IPs (e.g. during development) can't be geolocated.
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('::ffff:127.')) {
    return { country: null, region: null, city: null };
  }

  try {
    const cleanIp = ip.replace('::ffff:', '');
    const res = await fetch(`http://ip-api.com/json/${cleanIp}?fields=status,country,regionName,city`);
    const data = await res.json();
    if (data.status !== 'success') return { country: null, region: null, city: null };
    return { country: data.country || null, region: data.regionName || null, city: data.city || null };
  } catch (err) {
    console.warn('[geolocation] lookup failed:', err.message);
    return { country: null, region: null, city: null };
  }
}

module.exports = { lookupLocation };
