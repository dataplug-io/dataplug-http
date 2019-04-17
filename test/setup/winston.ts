// Copyright (C) 2017-2019 Brainbean Apps OU (https://brainbeanapps.com).
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).

import * as winston from 'winston'

winston.configure({
  transports: [
    new winston.transports.Console({ silent: true })
  ]
})
