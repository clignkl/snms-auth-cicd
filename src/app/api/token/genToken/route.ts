'use server'
import { postgreSQL } from '@/config/db'
import { User } from '@/types/users'
import { createToken, refreshToken } from '@/utils/jwtUtils'
import { apiResponse, errorResponse } from '@/utils/responseUtils'
import { emptyValidation } from '@/utils/validation'
import bcrypt from 'bcrypt'
import { NextRequest } from 'next/server'

export async function GET() {
  return errorResponse(405, { detailMessage: 'Invalid request method' })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const sessionID = body.sessionID ?? ''

  //vlidation 체크
  if (
    emptyValidation(body.email) ||
    (emptyValidation(sessionID.trim()) && emptyValidation(body.userPwd))
  ) {
    console.log('----------------------------------------------------')
    return errorResponse(400, { detailMessage: 'parameter is required.' })
  }
  const user = await getUser(body.email)

  if (!user) {
    return errorResponse(400, { detailMessage: 'not exist user.' })
  }

  //sessionID가 있는 경우는 로그인 이후 QR 로그인 시도하는 경우(패스워드 체크안함.)
  if (!sessionID.trim()) {
    const matchPwd = await bcrypt.compare(body.userPwd, user.password)
    if (!matchPwd) {
      return errorResponse(500, { detailMessage: 'not exist user.' })
    }
  }

  // token 발행
  const accessToken = createToken(body.email)
  const refresh = refreshToken(body.email)
  //sessionID 가 있는 경우 (QR스캔을 통한 2차인증)
  if (sessionID.trim()) {
    await postgreSQL.query(
      'UPDATE comdb.tbd_com_user_session SET email = $1, access_token = $2, refresh_token = $3 where session_id = $4 ',
      [body.email, accessToken, refresh, sessionID]
    )
  }
  return apiResponse({ email: body.email, accessToken: accessToken, refreshToken: refresh })
}

async function getUser(email: string): Promise<User | undefined> {
  try {
    const user = await postgreSQL.query<User>('SELECT * FROM users WHERE email=$1', [email])
    return user.rows[0]
  } catch (error) {
    console.error('Failed to fetch user:', error)
    throw new Error('Failed to fetch user.')
  }
}
