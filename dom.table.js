/**
 * Copyright © 2016 STRG.AT GmbH, Vienna, Austria
 *
 * This file is part of the The SCORE Framework.
 *
 * The SCORE Framework and all its parts are free software: you can redistribute
 * them and/or modify them under the terms of the GNU Lesser General Public
 * License version 3 as published by the Free Software Foundation which is in the
 * file named COPYING.LESSER.txt.
 *
 * The SCORE Framework and all its parts are distributed without any WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
 * PARTICULAR PURPOSE. For more details see the GNU Lesser General Public
 * License.
 *
 * If you have not received a copy of the GNU Lesser General Public License see
 * http://www.gnu.org/licenses/.
 *
 * The License-Agreement realised between you as Licensee and STRG.AT GmbH as
 * Licenser including the issue of its valid conclusion and its pre- and
 * post-contractual effects is governed by the laws of Austria. Any disputes
 * concerning this License-Agreement including the issue of its valid conclusion
 * and its pre- and post-contractual effects are exclusively decided by the
 * competent court, in whose district STRG.AT GmbH has its registered seat, at
 * the discretion of STRG.AT GmbH also the competent court, in whose district the
 * Licensee has his registered seat, an establishment or assets.
 */

// Universal Module Loader
// https://github.com/umdjs/umd
// https://github.com/umdjs/umd/blob/v1.0.0/returnExports.js
(function (root, factory) {
    /* global module */
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(['score.init', 'score.dom', 'score.oop'], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        factory(require('score.init'));
    } else {
        // Browser globals (root is window)
        factory(root.score);
    }
})(this, function(score) {

    return score.extend('dom.table', ['oop'], function() {

        var htmlTemplate = 
            '<div class="score-dom-table">' +
            '    <div class="score-dom-table__head">' +
            '        <table>' +
            '            <thead>' +
            '                <tr>' +
            '                </tr>' +
            '            </thead>' +
            '        </table>' +
            '    </div>' +
            '    <div class="score-dom-table__body">' +
            '        <table>' +
            '            <tbody>' +
            '            </tbody>' +
            '        </table>' +
            '    </div>' +
            '    <div class="score-dom-table-pager">' +
            '    </div>' +
            '</div>';

        var Table = score.oop.Class({
            __name__: 'Table',

            __static__: {

                hashString: function(cls, string) {
                    var from = 'àáäãâèéëêìíïîòóöôõùúüûñç';
                    var to = 'aaaaaeeeeiiiiooooouuuunc';
                    for (var i = 0; i < from.length; i++) {
                        string = string.replace(from.charAt(i), to.charAt(i) + 'zzz');
                    }
                    string = string.replace('ß', 'ssZZZ');
                    return string;
                },

                hashInt: function(cls, num) {
                    var result = '' + num;
                    var missing = 20 - result.length;
                    if (missing <= 0) {
                        return '' + result;
                    }
                    return '0'.repeat(missing) + result;
                },

                hashDate: function(cls, date) {
                    return date.toISOString();
                },

                defaults: {
                    rowsPerPage: 10,
                    initialSortIndex: 0,
                    pager: true,
                    numericPager: false,
                }

            },

            __init__: function(self, columns, options) {
                self.node = score.dom.fromString(htmlTemplate);
                self.options = {};
                for (var key in Table.defaults) {
                    self.options[key] = Table.defaults[key];
                }
                for (var key in options) {
                    self.options[key] = options[key];
                }
                self.page = 0;
                var clickHandler = function(event) {
                    self.orderBy(this);
                    event.preventDefault();
                    return false;
                };
                self.rowTpl = score.dom.create('tr');
                for (var i = 0; i < columns.length; i++) {
                    self.node.find('.score-dom-table__head tr').append(
                        score.dom.create('th')
                            .addClass('score-dom-table-header')
                            .text(columns[i])
                            .append(score.dom.create('div').addClass('score-dom-theater-header__sort-icon'))
                            .on('click', clickHandler));
                    self.rowTpl.append(score.dom.create('td')
                        .addClass('score-dom-table__field')
                        .addClass('score-dom-table__field--' + columns[i]));
                }
                if (!self.options.sortDirections) {
                    self.options.sortDirections = [];
                    for (var i = 0; i < columns.length; i++) {
                        self.options.sortDirections.push(1);
                    }
                }
                self.node.find('.score-dom-table__head tr th').eq(self.options.initialSortIndex)
                    .addClass('score-dom-table-header--sorted-asc');
                self.rowData = [];
                self.sortHashes = [];
                self.sortedIds = [];
                self.filters = [];
                self.filteredIds = [];
                if (!self.options.pager) {
                    self.node.find('.table-pager').attr('style', 'display:none');
                }
            },

            setRowData: function(self, rowData) {
                self.sortHashes = [];
                self.rowData = {};
                if (Array.isArray(rowData)) {
                    var tmp = {};
                    for (var i = 0; i < rowData.length; i++) {
                        tmp[rowData[i].id] = rowData[i];
                    }
                    rowData = tmp;
                }
                for (var id in rowData) {
                    self.rowData[id] = rowData[id];
                    var hashes = self._getSortHashes(rowData[id]);
                    if (self.sortHashes.length === 0) {
                        for (var i = 0; i < hashes.length; i++) {
                            self.sortHashes.push({});
                        }
                    }
                    if (self.sortHashes.length !== hashes.length) {
                        throw new Error('Sort hash length mismatch');
                    }
                    for (var i = 0; i < hashes.length; i++) {
                        var hash = hashes[i];
                        if (typeof self.sortHashes[i][hash] !== 'undefined') {
                            if (!(self.sortHashes[i][hash] instanceof Array)) {
                                self.sortHashes[i][hash] = [self.sortHashes[i][hash]];
                            }
                            self.sortHashes[i][hash].push(id);
                        } else {
                            self.sortHashes[i][hash] = id;
                        }
                    }
                }
                self.resort();
            },

            getRowData: function(self, id) {
                if (typeof id == 'undefined') {
                    return self.rowData;
                }
                return self.rowData[id];
            },

            countRowData: function(self) {
                var count = 0;
                for (var id in self.rowData) {  // jshint ignore: line
                    count++;
                }
                return count;
            },

            isEmpty: function(self) {
                for (var id in self.rowData) {  // jshint ignore: line
                    return false;
                }
                return true;
            },

            updateRow: function(self, rowNode, rowData) {
                rowNode.attr('data-id', rowData.id);
                self._updateRow(rowNode, rowData);
            },

            _updateRow: function(self, rowNode, rowData) {
                throw new Error('Abstract function ' + self.__class__.__name__ + '::_updateRow() called');
            },

            _getSortHashes: function(self, row) {
                throw new Error('Abstract function ' + self.__class__.__name__ + '::_getSortHashes() called');
            },

            addRowData: function(self, rowData) {
                var id = rowData.id;
                if (typeof id === 'undefined') {
                    throw new Error('rowData has no id');
                }
                if (id in self.rowData) {
                    throw new Error('Duplicate rowData id');
                }
                self.rowData[id] = rowData;
                var hashes = self._getSortHashes(self.rowData[id]);
                if (!self.sortHashes.length) {
                    for (var i = 0; i < hashes.length; i++) {
                        self.sortHashes.push({});
                    }
                } else if (self.sortHashes.length !== hashes.length) {
                    throw new Error('Sort hash length mismatch');
                }
                for (var i = 0; i < hashes.length; i++) {
                    var hash = hashes[i];
                    if (typeof self.sortHashes[i][hash] !== 'undefined') {
                        if (!(self.sortHashes[i][hash] instanceof Array)) {
                            self.sortHashes[i][hash] = [self.sortHashes[i][hash]];
                        }
                        self.sortHashes[i][hash].push(id);
                    } else {
                        self.sortHashes[i][hash] = id;
                    }
                }
                self.resort();
            },

            dataChanged: function(self, ids) {
                var id;
                if (typeof ids === 'number') {
                    id = ids;
                } else if (typeof ids === 'string') {
                    id = parseInt(ids, 10);
                } else if (!ids.length) {
                    return;
                } else if (ids.length === 1) {
                    id = ids[0];
                } else {
                    // multiple ids changed; be safe and reset the data
                    self.setRowData(self.rowData);
                    return;
                }
                for (var i = 0; i < self.sortHashes.length; i++) {
                    var found = false;
                    for (var hash in self.sortHashes[i]) {
                        if (self.sortHashes[i][hash] instanceof Array) {
                            for (var j = 0; j < self.sortHashes[i][hash].length; j++) {
                                if (self.sortHashes[i][hash][j] != id) {
                                    continue;
                                }
                                self.sortHashes[i][hash].splice(j, 1);
                                if (self.sortHashes[i][hash].length == 1) {
                                    self.sortHashes[i][hash] = self.sortHashes[i][hash][0];
                                }
                                found = true;
                                break;
                            }
                        } else if (self.sortHashes[i][hash] == id) {
                            delete(self.sortHashes[i][hash]);
                            found = true;
                        }
                        if (found) {
                            break;
                        }
                    }
                }
                var hashes = self._getSortHashes(self.rowData[id]);
                if (self.sortHashes.length !== hashes.length) {
                    throw new Error('Sort hash length mismatch');
                }
                for (var i = 0; i < hashes.length; i++) {
                    var hash = hashes[i];
                    if (typeof self.sortHashes[i][hash] !== 'undefined') {
                        if (!(self.sortHashes[i][hash] instanceof Array)) {
                            self.sortHashes[i][hash] = [self.sortHashes[i][hash]];
                        }
                        self.sortHashes[i][hash].push(id);
                    } else {
                        self.sortHashes[i][hash] = id;
                    }
                }
                var row = self.node.find('tr[data-id="' + id + '"]');
                if (row.length) {
                    self.updateRow(row, self.rowData[id]);
                }
                self.resort();
            },

            removeRowData: function(self, id) {
                self.node.find('tr[data-id="' + id + '"]').detach();
                delete(self.rowData[id]);
                for (var i = 0; i < self.sortHashes.length; i++) {
                    var found = false;
                    for (var hash in self.sortHashes[i]) {
                        if (self.sortHashes[i][hash] instanceof Array) {
                            for (var j = 0; j < self.sortHashes[i][hash].length; j++) {
                                if (self.sortHashes[i][hash][j] != id) {
                                    continue;
                                }
                                self.sortHashes[i][hash].splice(j, 1);
                                if (self.sortHashes[i][hash].length == 1) {
                                    self.sortHashes[i][hash] = self.sortHashes[i][hash][0];
                                }
                                found = true;
                                break;
                            }
                        } else if (self.sortHashes[i][hash] == id) {
                            delete(self.sortHashes[i][hash]);
                            found = true;
                        }
                        if (found) {
                            break;
                        }
                    }
                }
                self.resort();
            },

            orderBy: function(self, th) {
                var self = this;
                th = score.dom(th);
                if (th.hasClass('score-dom-table-header--sorted-asc')) {
                    th.removeClass('score-dom-table-header--sorted-asc');
                    th.addClass('score-dom-table-header--sorted-desc');
                } else if (th.hasClass('score-dom-table-header--sorted-desc')) {
                    th.removeClass('score-dom-table-header--sorted-desc');
                    th.addClass('score-dom-table-header--sorted-asc');
                } else {
                    var current = self.node.find('th.score-dom-table-header--sorted-asc, th.score-dom-table-header--sorted-desc');
                    if (current) {
                        current.removeClass('score-dom-table-header--sorted-desc');
                        current.removeClass('score-dom-table-header--sorted-asc');
                    }
                    th.addClass('score-dom-table-header--sorted-asc');
                }
                self.page = 0;
                self.resort();
            },

            resort: function(self) {
                var th, index;
                var headingCells = self.node.find('thead th');
                for (index = 0; index < headingCells.length; index++) {
                    var item = headingCells.eq(index);
                    if (item.hasClass('score-dom-table-header--sorted-asc') || item.hasClass('score-dom-table-header--sorted-desc')) {
                        th = item;
                        break;
                    }
                }
                var hash2id = self.sortHashes[index];
                var sortedHashes = [];
                for (var hash in self.sortHashes[index]) {
                    sortedHashes.push(hash);
                }
                sortedHashes.sort();
                if (self.options.sortDirections[index] < 0) {
                    sortedHashes.reverse();
                }
                if (th.hasClass('score-dom-table-header--sorted-desc')) {
                    sortedHashes.reverse();
                }
                self.sortedIds = [];
                for (var i = 0; i < sortedHashes.length; i++) {
                    if (hash2id[sortedHashes[i]] instanceof Array) {
                        for (var j = 0; j < hash2id[sortedHashes[i]].length; j++) {
                            self.sortedIds.push(hash2id[sortedHashes[i]][j]);
                        }
                    } else {
                        self.sortedIds.push(hash2id[sortedHashes[i]]);
                    }
                }
                self.applyFilter();
            },

            attachFilter: function(self, field, testGenerator) {
                self.filters.push({
                    field: field,
                    testGenerator: testGenerator
                });
                field.on('change', function() {
                    self.page = 0;
                    self.applyFilter();
                });
                self.applyFilter();
            },

            applyFilter: function(self) {
                self.filteredIds = self.sortedIds;
                for (var i = 0; i < self.filters.length; i++) {
                    var filter = self.filters[i];
                    var query = filter.field.getValue();
                    if (!query) {
                        continue;
                    }
                    var test = filter.testGenerator(query);
                    var ids = self.filteredIds;
                    self.filteredIds = [];
                    for (var j = 0; j < ids.length; j++) {
                        if (test(self.rowData[ids[j]])) {
                            self.filteredIds.push(ids[j]);
                        }
                    }
                }
                self.render();
            },

            setPage: function(self, page) {
                self.page = page;
                self.render();
            },

            _pageBack: function(self) {
                if (self.page === 0) {
                    return;
                }
                self.setPage(self.page - 1);
            },

            _pageForward: function(self) {
                if ((self.page + 1) * self.options.rowsPerPage > self.filteredIds.length) {
                    return;
                }
                self.setPage(self.page + 1);
            },

            render: function(self) {
                var ids = self.filteredIds.slice(self.options.rowsPerPage * self.page, self.options.rowsPerPage * (self.page + 1));
                var tbody = self.node.find('tbody');
                var numRows = Math.min(ids.length, self.options.rowsPerPage);
                if (ids.length === 0) {
                    tbody.children().detach();
                    self.updatePager();
                    return;
                }
                while (tbody.children().length > numRows) {
                    tbody.children().first.detach();
                }
                for (var i = 0; i < tbody.children().length; i++) {
                    self.updateRow(tbody.children().eq(i), self.rowData[ids[i]]);
                }
                for (var i = tbody.children().length; i < numRows; i++) {
                    var tr = self.rowTpl.clone();
                    tbody.append(tr);
                    self.updateRow(tr, self.rowData[ids[i]]);
                }
                self.updatePager();
            },

            updatePager: function(self) {
                if (!self.options.pager) {
                    return;
                }
                var pager = self.node.find('.score-dom-table-pager');
                if (self.options.numericPager) {
                    pager.children().detach();
                    if (self.filteredIds.length <= self.options.rowsPerPage) {
                        // don't render numbers, if there is only one page
                        return;
                    }
                    var createNumber = function(number) {
                        var span = score.dom.create('span')
                            .addClass('score-dom-table-pager__number')
                            .text(number + 1);
                        if (self.page !== number) {
                            span.on('click', function() {
                                self.setPage(number);
                            });
                        } else {
                            span.addClass('score-dom-table-pager__number--selected');
                        }
                        pager.append(span);
                    };
                    createNumber(0);
                    for (var i = 1; i * self.options.rowsPerPage < self.filteredIds.length; i++) {
                        createNumber(i);
                    }
                } else {
                    var back, forward;
                    if (pager.children().length) {
                        back = pager.children().eq(0);
                        forward = pager.children().eq(1);
                    } else {
                        back = score.dom.create('div')
                            .addClass('score-dom-table-pager__button')
                            .addClass('score-dom-table-pager__button--back')
                            .on('click', self._pageBack);
                        forward = score.dom.create('div')
                            .addClass('score-dom-table-pager__button')
                            .addClass('score-dom-table-pager__button--forward')
                            .on('click', self._pageForward);
                        pager.append(back);
                        pager.append(forward);
                    }
                    if (self.page > 0) {
                        back.addClass('score-dom-table-pager__button--active');
                    } else {
                        back.removeClass('score-dom-table-pager__button--active');
                    }
                    if ((self.page + 1) * self.options.rowsPerPage < self.filteredIds.length) {
                        forward.addClass('score-dom-table-pager__button--active');
                    } else {
                        forward.removeClass('score-dom-table-pager__button--active');
                    }
                }
            }

        });

        return Table;

    });

});
