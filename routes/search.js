// routes/search.js
// GET /search?state=Lagos&lga=Ikeja
router.get('/search', async (req, res) => {
  const { state, lga, q } = req.query;
  let qstr = `SELECT l.*, COALESCE(min(li.image_path),'') AS image_path FROM listings l LEFT JOIN listing_images li ON li.listing_id = l.id WHERE l.is_active = true`;
  const params = [];
  if (state) { params.push(state); qstr += ` AND l.state = $${params.length}`; }
  if (lga) { params.push(lga); qstr += ` AND l.lga = $${params.length}`; }
  if (q) { params.push(`%${q}%`); qstr += ` AND (l.title ILIKE $${params.length} OR l.description ILIKE $${params.length})`; }
  qstr += ` GROUP BY l.id ORDER BY l.created_at DESC`;
  const listings = await db.manyOrNone(qstr, params);
  res.render('search/results', { listings, state, lga, q });
});
