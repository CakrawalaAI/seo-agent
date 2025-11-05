import type { ComponentType } from 'react'
import { IntegrationFormPlaceholder as WebhookForm } from '../webhook/client/form'
import { IntegrationFormPlaceholder as RestApiForm } from '../rest-api/client/form'
import { IntegrationFormPlaceholder as WordpressForm } from '../wordpress/client/form'
import { IntegrationFormPlaceholder as WebflowForm } from '../webflow/client/form'
import { IntegrationFormPlaceholder as ShopifyForm } from '../shopify/client/form'
import { IntegrationFormPlaceholder as GhostForm } from '../ghost/client/form'
import { IntegrationFormPlaceholder as HubspotForm } from '../hubspot/client/form'
import { IntegrationFormPlaceholder as NotionForm } from '../notion/client/form'
import { IntegrationFormPlaceholder as SquarespaceForm } from '../squarespace/client/form'
import { IntegrationFormPlaceholder as WixForm } from '../wix/client/form'
import { IntegrationFormPlaceholder as FramerForm } from '../framer/client/form'
import { IntegrationFormPlaceholder as UnicornForm } from '../unicorn-platform/client/form'
import { IntegrationFormPlaceholder as ZapierForm } from '../zapier/client/form'

export const integrationForms: Record<string, ComponentType> = {
  webhook: WebhookForm,
  'rest-api': RestApiForm,
  'wordpress-org': WordpressForm,
  'wordpress-com': WordpressForm,
  webflow: WebflowForm,
  shopify: ShopifyForm,
  ghost: GhostForm,
  hubspot: HubspotForm,
  notion: NotionForm,
  squarespace: SquarespaceForm,
  wix: WixForm,
  framer: FramerForm,
  'unicorn-platform': UnicornForm,
  zapier: ZapierForm
}
