const express = require('express')
const app = express()

const bcrypt = require('bcrypt')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')

const jwt = require('jsonwebtoken')

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
app.use(express.json())
let db = null

const intializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server running on 3000')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

intializeDbAndServer()

const convertStateDbObjectToResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictDbObjectToResponseObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'Secret_Token', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

// API 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `select * from user where username = '${username}'`
  const user = await db.get(selectUserQuery)
  if (user === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, user.password)
    if (isPasswordMatched) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'Secret_Token')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// API 2
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesquery = 'select * from state;'
  const statesArray = await db.all(getStatesquery)

  response.send(
    statesArray.map(state => convertStateDbObjectToResponseObject(state)),
  )
})

// API 3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `select * from state where state_id = ${stateId}`
  const stateDetails = await db.get(getStateQuery)

  response.send(convertStateDbObjectToResponseObject(stateDetails))
})
// API 4
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const insertDistrictsquery = `insert into district(state_id, district_name, cases, cured, active,deaths ) values(${stateId},'${districtName}',${cases},${cured},${active},${deaths})`
  await db.run(insertDistrictsquery)

  response.send('District Successfully Added')
})

// API 5
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `select * from district where district_id = ${districtId};`
    const districtDetails = await db.get(getDistrictQuery)

    response.send(convertDistrictDbObjectToResponseObject(districtDetails))
  },
)

// API 6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `delete from district where district_id = ${districtId}`
    await db.run(deleteDistrictQuery)

    response.send('District Removed')
  },
)

// API 7
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const {districtId} = request.params
    const updateDistrictQurey = `update district set district_name = '${districtName}', state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} where district_id = ${districtId}`
    await db.run(updateDistrictQurey)

    response.send('District Details Updated')
  },
)

// API 8
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatisticsQuery = `select sum(cases),sum(cured),sum(active),sum(deaths) from district where state_id = ${stateId}`
    const stats = await db.get(getStatisticsQuery)

    response.send({
      totalCases: stats['sum(cases)'],
      totalCured: stats['sum(cured)'],
      totalActive: stats['sum(active)'],
      totalDeaths: stats['sum(deaths)'],
    })
  },
)

module.exports = app
