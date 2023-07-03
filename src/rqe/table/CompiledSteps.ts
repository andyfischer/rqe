
export interface InitializeAutoAttr {
    t: 'init_auto_attr'
    attr: string
}

export type PreInsertStep = InitializeAutoAttr

export interface InitializeTableAutoAttr {
    t: 'init_table_auto_attr'
    attr: string
}

export interface InitializeTableListenerStreams {
    t: 'init_listener_streams'
}

export type TableInitStep = InitializeTableAutoAttr | InitializeTableListenerStreams
