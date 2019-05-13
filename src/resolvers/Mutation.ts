import { booleanArg, arg, stringArg, idArg, mutationType } from 'nexus'
import * as bcrypt from 'bcryptjs'
import { APP_SECRET, getUserId } from '../utils'
import { sign } from 'jsonwebtoken'

export const Mutation = mutationType({
  definition(t) {
    t.field('setMood', {
      type: 'Mood',
      args:{
        date: stringArg(),
        type: arg({
          type: 'MoodTypes',
          required: true
        }),
        id: idArg({default: "",nullable: true})
      },
      resolve: (parent, { id, date, type }, ctx) => {
        const userId = getUserId(ctx);
        return ctx.prisma.upsertMood({
          where: {
            id
          },
          create: {
            date,
            type,
            owner: {
              connect: { id: userId },
            },
          },
          update: {
            type
          }
        })
      },
    })
    t.field('createHabit', {
      type: 'Habit',
      args: {
        id: idArg({default: "", required: false}),
        title: stringArg({required: true}),
        description: stringArg({required: false, default: ""}),
        starred: booleanArg({default: false, nullable: true})
      },
      resolve: (parent, { id, title, description, starred }, ctx) => {
        const userId = getUserId(ctx);
        return ctx.prisma.upsertHabit({
          where: {id},
          create: {
            description: description || '',
            starred: !!starred,
            title,
            owner: { connect: { id: userId } }
          },
          update: {
            ...(description && {description}),
            ...(title && {title}),
            starred: !!starred,
          }
        })
      },
    })
    t.field('setDailyHabit', {
      type: 'DayHabit',
      args: {
        date: stringArg(),
        done: booleanArg({default: false, nullable: true}),
        id: idArg({default: "", required: false})
      },
      resolve: (parent, { id, date, done }, ctx) => {
        const userId = getUserId(ctx);
        return ctx.prisma.upsertDayHabit({
          where: {id},
          create: {
            date,
            done,
            habit: {connect:{id}}
          },
          update:{
            done
          }
        })
      }
    })
    t.field('signup', {
      type: 'AuthPayload',
      args: {
        name: stringArg({ nullable: true }),
        email: stringArg(),
        password: stringArg(),
      },
      resolve: async (parent, { name, email, password }, ctx) => {
        const hashedPassword = await bcrypt.hash(password, 10)
        const user = await ctx.prisma.createUser({
          name,
          email,
          password: hashedPassword,
        })
        return {
          token: sign({ userId: user.id }, APP_SECRET),
          user,
        }
      },
    })

    t.field('login', {
      type: 'AuthPayload',
      args: {
        email: stringArg(),
        password: stringArg(),
      },
      resolve: async (parent, { email, password }, context) => {
        const user = await context.prisma.user({ email })
        if (!user) {
          throw new Error(`No user found for email: ${email}`)
        }
        const passwordValid = await bcrypt.compare(password, user.password)
        if (!passwordValid) {
          throw new Error('Invalid password')
        }
        return {
          token: sign({ userId: user.id }, APP_SECRET),
          user,
        }
      },
    })
  },
})