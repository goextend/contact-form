'use strict';

const wreck = require('wreck');
const _ = require('lodash');

// This webtask is used to handle form fills for the goExtend Website.
// There are 2 form fill types:
//   (1) Contact Sales
//   (2) Submit Support Ticket
//
// This webtask integrates with our Intercom and Zendesk subscriptions
// and requires 2 secrets: INTERCOM_AT, ZENDESK_TOKEN
//
// This webtask is deployed at: https://wtg-extend-prod.sandbox.auth0-extend.com/goextend-contact-support

const intercomUsersUrl = 'https://api.intercom.io/users';
const zendeskTicketsUrl = 'https://auth0.zendesk.com/api/v2/tickets.json';

async function main(context, cb) {
  try {
    await handleRequest(context)
    return cb(null, { message: 'Form submission received'});
  } catch (error) {
    return cb(error);
  }
}

async function handleRequest(context) {
  ensureBodyProperties(context, ['subject']);
  const subject = context.body.subject;

  if (subject === 'extend_sales') {
    return Promise.all([
      upsertToIntercom(context),
      upsertToZendesk(context)
    ]);
  } else if (subject === 'extend_support') {
    return upsertToZendesk(context);
  }

  throw new Error('Invalid \'subject\' property value.');
}

function ensureBodyProperties(context, properties) {
  const body = context.body || {};
  for (const prop of properties) {
    if (!body[prop]) {
      throw new Error(`Request body did not include the '${prop}' property.`)
    }
  }
}

async function upsertToIntercom(context) {
  ensureBodyProperties(context, ['name', 'email', 'company', 'role']);

  const options = {
    headers: {
      'Authorization': `Bearer ${context.secrets.INTERCOM_AT}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({
      email: context.body.email,
      name: context.body.name,
      custom_attributes: {
        company: context.body.company,
        role: context.body.role,
        extend: true,
        extend_last_seen_at: new Date(),
      }
    })
  };

  try {
    await wreck.post(intercomUsersUrl, options);
  } catch (error) {
    console.log('[Error]', 'Upsert to Intercom -', error.message);
  }
}

async function upsertToZendesk(context) {
  ensureBodyProperties(context, ['name', 'email', 'message', 'subject']);

  const userAndPassword = `glenn.block@auth0.com/token:${context.secrets.ZENDESK_TOKEN}`;
  const customFields = [
      { id: 56588368, value: 'extend_contact_form' },
      { id: 80837608, value: context.body.subject },
  ];

  if (context.body.company) {
    customFields.push({ id: 56256027, value: context.body.company });
  }

  if (context.body.role) {
    customFields.push({ id: 56588348, value: context.body.role });
  }

  if (context.body.hostUrl) {
    customFields.push({ id: 360008343073, value: context.body.hostUrl });
  }

  const payload = {
      ticket: {
        subject: `Source [Auth0 Extend]: 'contact_form' ${context.body.subject}`,
        ticket_form_id: 622708,
        group_id: 40953288,
        description: context.body.message,
        requester: {
          name: context.body.name + "/token",
          email: context.body.email
        },
        tags: ["extend_contact", 'extend_contact_form'],
        custom_fields: customFields
      }
  };

  if (_.isString(context.body.severity)) {
    payload.ticket.priority = _.toLower(context.body.severity);
  }

  const options = {
    headers: {
      'Authorization': `Basic ${Buffer.from(userAndPassword).toString('base64')}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };

  try {
    await wreck.post(zendeskTicketsUrl, options);
  } catch (error) {
    console.log('[Error]', 'Upsert Ticket to Zendesk -', error.message);
  }
}

module.exports = main;
