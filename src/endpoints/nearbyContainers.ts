import type { Endpoint } from 'payload'
import { sql } from '@payloadcms/db-postgres'

export const nearbyContainers: Endpoint = {
  path: '/nearby',
  method: 'get',
  handler: async (req) => {
    const { payload } = req

    // Parse query parameters from req.query (Payload provides this)
    const latitude = parseFloat((req.query?.latitude as string) || '')
    const longitude = parseFloat((req.query?.longitude as string) || '')
    const radius = parseFloat((req.query?.radius as string) || '300') // Default 500 meters
    const status = req.query?.status as string // Optional: 'active', 'full', 'maintenance', 'inactive'
    const wasteType = req.query?.wasteType as string // Optional: filter by waste type
    const limit = parseInt((req.query?.limit as string) || '100', 10)

    console.log('[nearbyContainers] Request params:', { latitude, longitude, radius, status, wasteType, limit })

    // Validate required parameters
    if (isNaN(latitude) || isNaN(longitude)) {
      return Response.json(
        { error: 'Invalid or missing latitude/longitude parameters' },
        { status: 400 }
      )
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return Response.json(
        { error: 'Latitude must be between -90 and 90, longitude between -180 and 180' },
        { status: 400 }
      )
    }

    if (radius <= 0 || radius > 10000) {
      return Response.json(
        { error: 'Radius must be between 0 and 10000 meters' },
        { status: 400 }
      )
    }

    try {
      // Access the database adapter
      const db = payload.db

      // Add back created_at and updated_at
      const query = sql`
        SELECT 
          wc.id,
          wc.public_number,
          wc.location_latitude,
          wc.location_longitude,
          wc.location_address,
          wc.capacity_volume,
          wc.waste_type,
          wc.status,
          wc.capacity_size,
          wc.service_interval,
          wc.serviced_by,
          wc.notes,
          wc.last_cleaned,
          wc.created_at,
          wc.updated_at,
          COALESCE(json_agg(wcs.value) FILTER (WHERE wcs.value IS NOT NULL), '[]'::json) as state,
          ST_Distance(
            ST_MakePoint(${longitude}, ${latitude})::geography,
            ST_MakePoint(wc.location_longitude, wc.location_latitude)::geography
          ) as distance
        FROM waste_containers wc
        LEFT JOIN waste_containers_state wcs ON wcs.parent_id = wc.id
        WHERE ST_DWithin(
          ST_MakePoint(${longitude}, ${latitude})::geography,
          ST_MakePoint(wc.location_longitude, wc.location_latitude)::geography,
          ${radius}
        )
        GROUP BY wc.id
        ORDER BY distance ASC
        LIMIT ${limit}
      `
      
      console.log('[nearbyContainers] Executing PostGIS query:', { longitude, latitude, radius, limit })

      // Execute the query
      const result = await db.drizzle.execute(query)
      
      console.log('[nearbyContainers] Query executed successfully, rows:', result.rows.length, result.rows[0])

      for(const row of result.rows) {
        if (row.state && row.state.length > 0) {
          console.log('[nearbyContainers] Container state data:', row.state)
        }
      }

      // Transform the results to match the WasteContainer type
      const containers = result.rows.map((row: any) => ({
        id: row.id,
        publicNumber: row.public_number,
        location: {
          latitude: parseFloat(row.location_latitude),
          longitude: parseFloat(row.location_longitude),
          address: row.location_address,
        },
        capacityVolume: parseFloat(row.capacity_volume),
        capacitySize: row.capacity_size,
        serviceInterval: row.service_interval,
        servicedBy: row.serviced_by,
        wasteType: row.waste_type,
        status: row.status,
        state: Array.isArray(row.state) ? row.state : [],
        notes: row.notes,
        lastCleaned: row.last_cleaned,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        distance: Math.round(parseFloat(row.distance)), // Distance in meters, rounded
      }))

      // If we need to populate image relationships, we can do additional queries
      // For now, returning just the IDs for better performance
      // Frontend can request full image data if needed via separate calls

      return Response.json(
        {
          docs: containers,
          totalDocs: containers.length,
          limit,
          page: 1,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
        { status: 200 }
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorStack = error instanceof Error ? error.stack : ''
      
      payload.logger.error(`Error fetching nearby containers: ${errorMessage}`)
      payload.logger.error(`Stack trace: ${errorStack}`)
      
      return Response.json(
        { 
          error: 'Failed to fetch nearby containers',
          details: errorMessage,
          params: { latitude, longitude, radius, status, wasteType, limit }
        },
        { status: 500 }
      )
    }
  },
}
